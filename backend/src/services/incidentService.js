import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Incident } from '../models/Incident.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { DisciplinaryCase } from '../models/DisciplinaryCase.js';
import { Evidence } from '../models/Evidence.js';
import { IncidentHistory } from '../models/IncidentHistory.js';
import { AuditLog } from '../models/AuditLog.js';
import { Notification } from '../models/Notification.js';
import { CaseHistory } from '../models/CaseHistory.js';
import { INCIDENT_OUTCOMES, INCIDENT_STATES, canTransitionIncident } from '../domain/incidentStates.js';
import { recordIncidentTransition } from './incidentHistoryService.js';
import { createInitialCase } from './caseManagementService.js';
import { createEvidenceReference } from './evidenceService.js';
import { notifyReporter, queueIncidentForReview } from './notificationService.js';

export class IncidentServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function publicIncidentId(prefix) {
  return `${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function requireTransition(fromState, toState) {
  if (!canTransitionIncident(fromState, toState)) {
    throw new IncidentServiceError(409, 'This incident is no longer in a state that allows that action.');
  }
}

export async function submitIncident(reporterId, input) {
  const student = await StudentProfile.findOne({ studentId: input.studentId }).select('_id studentId').lean();
  if (!student) throw new IncidentServiceError(400, 'That student roll number was not found. Check it and try again.');

  let createdIncident;
  try {
    const incident = await Incident.create({
      incidentId: publicIncidentId('IN'),
      studentId: student._id,
      reporterId,
      incidentDateTime: input.incidentDateTime,
      location: input.location,
      subject: input.subject,
      description: input.description,
      reportedDate: new Date(),
      status: INCIDENT_STATES.SUBMITTED,
    });
    createdIncident = incident;
    await recordIncidentTransition({
      incidentId: incident._id, actorId: reporterId, action: 'incident.submitted',
      fromState: INCIDENT_STATES.DRAFT, toState: INCIDENT_STATES.SUBMITTED,
    });
    if (input.evidenceDescription) {
      await createEvidenceReference(incident._id, reporterId, input.evidenceDescription);
    }
    await queueIncidentForReview(incident);
    return { id: incident.id, incidentId: incident.incidentId, status: incident.status, reportedDate: incident.reportedDate };
  } catch (error) {
    if (createdIncident) {
      const incidentId = String(createdIncident._id);
      await Promise.allSettled([
        IncidentHistory.deleteMany({ incidentId: createdIncident._id }),
        Evidence.deleteMany({ incidentId: createdIncident._id }),
        AuditLog.deleteMany({ entityType: 'Incident', entityId: incidentId }),
        Notification.deleteMany({ entityType: 'Incident', entityId: incidentId }),
        Incident.deleteOne({ _id: createdIncident._id }),
      ]);
    }
    if (error?.code === 11000) throw new IncidentServiceError(503, 'The report could not be saved. Please try again.');
    throw error;
  }
}

export async function reviewIncident(incidentMongoId, reviewerId, input) {
  if (!mongoose.isValidObjectId(incidentMongoId)) throw new IncidentServiceError(404, 'Incident not found.');
  try {
      const incident = await Incident.findById(incidentMongoId);
      if (!incident) throw new IncidentServiceError(404, 'Incident not found.');

      if (input.action === 'begin') {
        requireTransition(incident.status, INCIDENT_STATES.REVIEW);
        incident.status = INCIDENT_STATES.REVIEW;
        incident.reviewedBy = reviewerId;
        incident.reviewedAt = new Date();
        await incident.save();
        await recordIncidentTransition({
          incidentId: incident._id, actorId: reviewerId, action: 'incident.review_started',
          fromState: INCIDENT_STATES.SUBMITTED, toState: INCIDENT_STATES.REVIEW,
        });
        await notifyReporter(incident.reporterId, incident, 'incident.review_started');
      } else if (input.action === 'accept') {
        requireTransition(incident.status, INCIDENT_STATES.CONVERTED);
        const fromState = incident.status;
        const previous = incident.toObject();
        const now = new Date();
        try {
          const disciplinaryCase = await createInitialCase(incident, reviewerId);
          incident.status = INCIDENT_STATES.CONVERTED;
          incident.outcome = INCIDENT_OUTCOMES.CONVERTED;
          incident.reviewedBy = reviewerId;
          incident.reviewedAt = now;
          incident.caseId = disciplinaryCase._id;
          await incident.save();
          await recordIncidentTransition({
            incidentId: incident._id, actorId: reviewerId, action: 'incident.converted_to_case',
            fromState, toState: INCIDENT_STATES.CONVERTED,
          });
          requireTransition(incident.status, INCIDENT_STATES.FINAL);
          incident.status = INCIDENT_STATES.FINAL;
          await incident.save();
          await recordIncidentTransition({
            incidentId: incident._id, actorId: reviewerId, action: 'incident.processing_finalized',
            fromState: INCIDENT_STATES.CONVERTED, toState: INCIDENT_STATES.FINAL,
          });
          await notifyReporter(incident.reporterId, incident, 'incident.converted_to_case');
          return { status: incident.status, outcome: incident.outcome, caseNumber: disciplinaryCase.caseNumber };
        } catch (error) {
          if (error?.code === 11000) throw error;
          const createdCase = await DisciplinaryCase.findOne({ incidentId: incident._id }).select('_id').lean();
          const set = { status: previous.status };
          const unset = {};
          for (const field of ['outcome', 'reviewReason', 'reviewedBy', 'reviewedAt', 'caseId']) {
            if (previous[field] === undefined) unset[field] = 1;
            else set[field] = previous[field];
          }
          await Promise.allSettled([
            Incident.updateOne({ _id: incident._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }),
            IncidentHistory.deleteMany({ incidentId: incident._id, eventType: { $in: ['incident.converted_to_case', 'incident.processing_finalized'] } }),
            AuditLog.deleteMany({ entityType: 'Incident', entityId: String(incident._id), action: { $in: ['incident.converted_to_case', 'incident.processing_finalized'] } }),
            Notification.deleteMany({ entityType: 'Incident', entityId: String(incident._id), notificationType: 'incident.converted_to_case' }),
            ...(createdCase ? [
              CaseHistory.deleteMany({ caseId: createdCase._id }),
              AuditLog.deleteMany({ entityType: 'DisciplinaryCase', entityId: String(createdCase._id) }),
              DisciplinaryCase.deleteOne({ _id: createdCase._id }),
            ] : []),
          ]);
          throw error;
        }
      } else {
        requireTransition(incident.status, INCIDENT_STATES.REJECTED);
        const fromState = incident.status;
        const now = new Date();
        incident.status = INCIDENT_STATES.REJECTED;
        incident.outcome = INCIDENT_OUTCOMES.REJECTED;
        incident.reviewReason = input.reason;
        incident.reviewedBy = reviewerId;
        incident.reviewedAt = now;
        await incident.save();
        await recordIncidentTransition({
          incidentId: incident._id, actorId: reviewerId, action: 'incident.rejected',
          fromState, toState: INCIDENT_STATES.REJECTED, reason: input.reason,
        });
        requireTransition(incident.status, INCIDENT_STATES.FINAL);
        incident.status = INCIDENT_STATES.FINAL;
        await incident.save();
        await recordIncidentTransition({
          incidentId: incident._id, actorId: reviewerId, action: 'incident.processing_finalized',
          fromState: INCIDENT_STATES.REJECTED, toState: INCIDENT_STATES.FINAL,
        });
        await notifyReporter(incident.reporterId, incident, 'incident.rejected');
        return { status: incident.status, outcome: incident.outcome };
      }
      return { status: incident.status };
  } catch (error) {
    if (error?.code === 11000) throw new IncidentServiceError(409, 'This incident has already been converted into a case.');
    throw error;
  }
}

export async function listIncidentsForUser(user) {
  const query = user.role === 'discipline_officer'
    ? { status: { $in: [INCIDENT_STATES.SUBMITTED, INCIDENT_STATES.REVIEW] } }
    : { reporterId: user.id };
  const incidents = await Incident.find(query, 'incidentId studentId reporterId incidentDateTime location subject reportedDate status outcome caseId reviewReason')
    .sort({ reportedDate: -1 }).limit(100).populate('studentId', 'studentId').lean();
  return incidents.map((incident) => ({
    id: String(incident._id), incidentId: incident.incidentId, studentId: incident.studentId?.studentId,
    incidentDateTime: incident.incidentDateTime, location: incident.location, subject: incident.subject,
    reportedDate: incident.reportedDate, status: incident.status, outcome: incident.outcome,
    caseId: incident.caseId ? String(incident.caseId) : undefined,
    reviewReason: user.role === 'reporting_staff' ? incident.reviewReason : undefined,
  }));
}

export async function getIncidentForUser(incidentMongoId, user) {
  if (!mongoose.isValidObjectId(incidentMongoId)) throw new IncidentServiceError(404, 'Incident not found.');
  const query = user.role === 'discipline_officer'
    ? { _id: incidentMongoId, status: { $in: [INCIDENT_STATES.SUBMITTED, INCIDENT_STATES.REVIEW] } }
    : { _id: incidentMongoId, reporterId: user.id };
  const incident = await Incident.findOne(query).populate('studentId', 'studentId').lean();
  if (!incident) throw new IncidentServiceError(404, 'Incident not found.');
  const evidence = await Evidence.find({ incidentId: incident._id }, 'evidenceId description uploadTimestamp accessClassification').lean();
  let caseNumber;
  if (incident.caseId) {
    const disciplinaryCase = await DisciplinaryCase.findById(incident.caseId, 'caseNumber').lean();
    caseNumber = disciplinaryCase?.caseNumber;
  }
  return {
    id: String(incident._id), incidentId: incident.incidentId,
    studentId: incident.studentId?.studentId, reporterId: String(incident.reporterId),
    incidentDateTime: incident.incidentDateTime, location: incident.location, subject: incident.subject,
    description: incident.description, reportedDate: incident.reportedDate, status: incident.status,
    outcome: incident.outcome, reviewReason: incident.reviewReason, caseNumber,
    evidence: evidence.map(({ evidenceId, description, uploadTimestamp, accessClassification }) => ({ evidenceId, description, uploadTimestamp, accessClassification })),
  };
}
