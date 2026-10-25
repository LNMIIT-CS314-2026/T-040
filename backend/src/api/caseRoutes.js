import { Router } from 'express';
import mongoose from 'mongoose';
import { requireRole } from '../auth/access.js';
import { ROLES } from '../domain/roles.js';
import { DisciplinaryCase } from '../models/DisciplinaryCase.js';
import { Hearing } from '../models/Hearing.js';
import { CaseHistory } from '../models/CaseHistory.js';
import { appendAudit } from '../services/auditService.js';
import { CaseDecision } from '../models/CaseDecision.js';
import { DisciplinaryAction } from '../models/DisciplinaryAction.js';
import { shiftCalendarMonth } from '../domain/dateLimits.js';

export const caseRoutes = Router();
caseRoutes.use(requireRole(ROLES.OFFICER));

caseRoutes.get('/', async (_req, res, next) => {
  try {
    const activeActionCaseIds = await DisciplinaryAction.distinct('caseId', { status: { $in: ['assigned', 'in_progress'] } });
    const cases = await DisciplinaryCase.find({ $or: [{ currentStatus: 'open' }, { _id: { $in: activeActionCaseIds } }] })
      .sort({ openedDate: -1 }).populate('studentId', 'studentId').lean();
    const caseIds = cases.map((item) => item._id);
    const [hearings, decisions, actions] = await Promise.all([
      Hearing.find({ caseId: { $in: caseIds } }).sort({ scheduledAt: 1 }).lean(),
      CaseDecision.find({ caseId: { $in: caseIds } }).lean(),
      DisciplinaryAction.find({ caseId: { $in: caseIds } }).sort({ createdAt: 1 }).lean(),
    ]);
    const byCase = new Map();
    for (const hearing of hearings) {
      const key = String(hearing.caseId);
      byCase.set(key, [...(byCase.get(key) || []), hearing]);
    }
    const decisionByCase = new Map(decisions.map((decision) => [String(decision.caseId), decision]));
    const actionsByCase = new Map();
    for (const action of actions) {
      const key = String(action.caseId);
      actionsByCase.set(key, [...(actionsByCase.get(key) || []), action]);
    }
    return res.json({ cases: cases.map((item) => ({
      ...item, hearings: byCase.get(String(item._id)) || [], decision: decisionByCase.get(String(item._id)) || null,
      actions: actionsByCase.get(String(item._id)) || [],
    })) });
  } catch (error) { return next(error); }
});

caseRoutes.post('/:caseId/decision', async (req, res, next) => {
  const { finding, rationale, actions = [] } = req.body || {};
  const allowedFindings = ['responsible', 'not_responsible', 'inconclusive'];
  const allowedActionTypes = ['warning', 'suspension', 'other'];
  const validActions = Array.isArray(actions) && actions.length <= 8 && actions.every((action) => {
    if (!action || !allowedActionTypes.includes(action.type) || typeof action.description !== 'string'
        || !action.description.trim() || action.description.trim().length > 2000) return false;
    if (!action.dueDate) return true;
    const dueDate = new Date(action.dueDate);
    return !Number.isNaN(dueDate.getTime());
  });
  if (!mongoose.isValidObjectId(req.params.caseId) || !allowedFindings.includes(finding)
      || typeof rationale !== 'string' || !rationale.trim() || rationale.trim().length > 5000 || !validActions
      || (finding === 'responsible' && actions.length === 0) || (finding !== 'responsible' && actions.length > 0)) {
    return res.status(400).json({ error: 'Provide a valid finding and rationale. A responsible finding requires at least one valid action; other findings cannot include actions.' });
  }
  try {
    const disciplinaryCase = await DisciplinaryCase.findOne({ _id: req.params.caseId, currentStatus: 'open' });
    if (!disciplinaryCase) return res.status(404).json({ error: 'Open case not found.' });
    const completedHearing = await Hearing.exists({ caseId: disciplinaryCase._id, status: 'completed' });
    if (!completedHearing) return res.status(409).json({ error: 'Complete at least one case hearing before recording a decision.' });
    if (await CaseDecision.exists({ caseId: disciplinaryCase._id })) return res.status(409).json({ error: 'A decision has already been recorded for this case.' });

    const [decision] = await CaseDecision.create([{
      caseId: disciplinaryCase._id, incidentId: disciplinaryCase.incidentId, studentId: disciplinaryCase.studentId,
      decidedBy: req.user.id, finding, rationale: rationale.trim(),
    }]);
    let createdActions = [];
    try {
      if (actions.length) {
        createdActions = await DisciplinaryAction.create(actions.map((action) => ({
          caseId: disciplinaryCase._id, decisionId: decision._id, studentId: disciplinaryCase.studentId,
          type: action.type, description: action.description.trim(), ...(action.dueDate ? { dueDate: new Date(action.dueDate) } : {}),
          status: 'completed', resolvedAt: new Date(), createdBy: req.user.id,
        })));
      }
      disciplinaryCase.currentStatus = 'closed';
      disciplinaryCase.closureDate = new Date();
      await disciplinaryCase.save();
    } catch (error) {
      await DisciplinaryAction.deleteMany({ decisionId: decision._id });
      await CaseDecision.deleteOne({ _id: decision._id });
      throw error;
    }
    await CaseHistory.create([{ caseId: disciplinaryCase._id, incidentId: disciplinaryCase.incidentId, actorId: req.user.id, eventType: 'decision.recorded' }]);
    await appendAudit({ actorId: req.user.id, action: 'case.decision.recorded', entityType: 'DisciplinaryCase', entityId: String(disciplinaryCase._id) });
    for (const action of createdActions) {
      await CaseHistory.create([{ caseId: disciplinaryCase._id, incidentId: disciplinaryCase.incidentId, actorId: req.user.id, eventType: 'action.completed' }]);
      await appendAudit({ actorId: req.user.id, action: 'disciplinary_action.completed', entityType: 'DisciplinaryAction', entityId: String(action._id) });
    }
    return res.status(201).json({ decision, actions: createdActions, caseStatus: disciplinaryCase.currentStatus });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'A decision has already been recorded for this case.' });
    return next(error);
  }
});

caseRoutes.post('/:caseId/hearings', async (req, res, next) => {
  const { scheduledAt, location } = req.body || {};
  const date = new Date(scheduledAt);
  const now = new Date();
  if (!mongoose.isValidObjectId(req.params.caseId) || !scheduledAt || Number.isNaN(date.getTime()) || date <= now || date > shiftCalendarMonth(now, 1)
      || typeof location !== 'string' || !location.trim() || location.trim().length > 200) {
    return res.status(400).json({ error: 'Choose a hearing date within the next month and provide a location (up to 200 characters).' });
  }
  try {
    const disciplinaryCase = await DisciplinaryCase.findOne({ _id: req.params.caseId, currentStatus: 'open' });
    if (!disciplinaryCase) return res.status(404).json({ error: 'Open case not found.' });
    const [hearing] = await Hearing.create([{
      caseId: disciplinaryCase._id, studentId: disciplinaryCase.studentId, scheduledBy: req.user.id,
      scheduledAt: date, location: location.trim(),
    }]);
    await CaseHistory.create([{ caseId: disciplinaryCase._id, incidentId: disciplinaryCase.incidentId, actorId: req.user.id, eventType: 'hearing.scheduled' }]);
    await appendAudit({ actorId: req.user.id, action: 'hearing.scheduled', entityType: 'Hearing', entityId: String(hearing._id) });
    return res.status(201).json({ hearing });
  } catch (error) { return next(error); }
});

caseRoutes.patch('/hearings/:hearingId/complete', async (req, res, next) => {
  const proceedings = req.body?.proceedings;
  if (!mongoose.isValidObjectId(req.params.hearingId) || typeof proceedings !== 'string' || !proceedings.trim() || proceedings.trim().length > 5000) {
    return res.status(400).json({ error: 'Record the hearing proceedings (up to 5,000 characters).' });
  }
  try {
    const hearing = await Hearing.findById(req.params.hearingId);
    if (!hearing) return res.status(404).json({ error: 'Hearing not found.' });
    if (hearing.status !== 'scheduled') return res.status(409).json({ error: 'Only a scheduled hearing can be completed.' });
    if (hearing.scheduledAt > new Date()) return res.status(409).json({ error: 'A hearing cannot be completed before its scheduled date and time.' });
    hearing.status = 'completed';
    hearing.proceedings = proceedings.trim();
    hearing.completedAt = new Date();
    await hearing.save();
    const disciplinaryCase = await DisciplinaryCase.findById(hearing.caseId, 'incidentId');
    await CaseHistory.create([{ caseId: hearing.caseId, incidentId: disciplinaryCase.incidentId, actorId: req.user.id, eventType: 'hearing.completed' }]);
    await appendAudit({ actorId: req.user.id, action: 'hearing.completed', entityType: 'Hearing', entityId: String(hearing._id) });
    return res.json({ hearing });
  } catch (error) { return next(error); }
});
