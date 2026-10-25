import { CaseHistory } from '../models/CaseHistory.js';
import { appendAudit } from './auditService.js';

export async function recordCaseCreation({ caseId, incidentId, actorId }, options = {}) {
  await CaseHistory.create([{ caseId, incidentId, actorId, eventType: 'case.created.from_incident' }], options);
  await appendAudit({ actorId, action: 'case.created', entityType: 'DisciplinaryCase', entityId: String(caseId) }, options);
}
