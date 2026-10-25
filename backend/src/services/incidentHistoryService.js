import { IncidentHistory } from '../models/IncidentHistory.js';
import { appendAudit } from './auditService.js';

export async function recordIncidentTransition({ incidentId, actorId, action, fromState, toState, reason }, options = {}) {
  await IncidentHistory.create([{
    incidentId, actorId, eventType: action, fromState, toState,
    ...(reason ? { reason } : {}),
  }], options);
  await appendAudit({ actorId, action, entityType: 'Incident', entityId: String(incidentId) }, options);
}
