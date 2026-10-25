import { Router } from 'express';
import { requireRole } from '../auth/access.js';
import { ROLES } from '../domain/roles.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Incident } from '../models/Incident.js';
import { DisciplinaryCase } from '../models/DisciplinaryCase.js';
import { Hearing } from '../models/Hearing.js';
import { CaseDecision } from '../models/CaseDecision.js';
import { DisciplinaryAction } from '../models/DisciplinaryAction.js';

export const studentRoutes = Router();
studentRoutes.get('/me/profile', requireRole(ROLES.STUDENT), async (req, res, next) => {
  try {
    const [user, studentProfile] = await Promise.all([
      User.findById(req.user.id, 'name email accountStatus').lean(),
      StudentProfile.findOne({ userId: req.user.id }, 'studentId academicStatus').lean(),
    ]);
    if (!user) return res.status(404).json({ error: 'Profile not found.' });
    if (!studentProfile) return res.status(404).json({ error: 'Profile not found.' });
    const incidents = await Incident.find({ studentId: studentProfile._id }, 'incidentId subject reportedDate status outcome caseId')
      .sort({ reportedDate: -1 }).limit(50).populate('caseId', 'caseNumber currentStatus').lean();
    const cases = await DisciplinaryCase.find({ studentId: studentProfile._id }, '_id caseNumber currentStatus closureDate').lean();
    const hearings = await Hearing.find({ caseId: { $in: cases.map((item) => item._id) } }, 'caseId scheduledAt location status proceedings completedAt')
      .sort({ scheduledAt: -1 }).lean();
    const [decisions, actions] = await Promise.all([
      CaseDecision.find({ caseId: { $in: cases.map((item) => item._id) } }, 'caseId finding rationale decidedAt').lean(),
      DisciplinaryAction.find({ caseId: { $in: cases.map((item) => item._id) } }, 'caseId type description dueDate status resolvedAt').sort({ createdAt: -1 }).lean(),
    ]);
    const caseNumbers = new Map(cases.map((item) => [String(item._id), item.caseNumber]));
    return res.json({
      profile: { ...user, ...studentProfile },
      incidents: incidents.map((incident) => ({
        id: String(incident._id),
        incidentId: incident.incidentId,
        subject: incident.subject,
        reportedDate: incident.reportedDate,
        status: incident.status,
        outcome: incident.outcome,
        caseNumber: incident.caseId?.caseNumber,
        caseStatus: incident.caseId?.currentStatus,
      })),
      hearings: hearings.map((hearing) => ({
        id: String(hearing._id), caseNumber: caseNumbers.get(String(hearing.caseId)), scheduledAt: hearing.scheduledAt,
        location: hearing.location, status: hearing.status, proceedings: hearing.proceedings, completedAt: hearing.completedAt,
      })),
      decisions: decisions.map((decision) => ({
        id: String(decision._id), caseNumber: caseNumbers.get(String(decision.caseId)), finding: decision.finding,
        rationale: decision.rationale, decidedAt: decision.decidedAt,
      })),
      actions: actions.map((action) => ({
        id: String(action._id), caseNumber: caseNumbers.get(String(action.caseId)), type: action.type,
        description: action.description, dueDate: action.dueDate, status: action.status,
        resolvedAt: action.resolvedAt,
      })),
      cases: cases.map((item) => ({ caseNumber: item.caseNumber, status: item.currentStatus, closureDate: item.closureDate })),
      notices: [],
    });
  } catch (error) { return next(error); }
});
