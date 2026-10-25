import { AuditLog } from '../models/AuditLog.js';

export function appendAudit({ actorId, action, entityType, entityId }, options = {}) {
  return AuditLog.create([{ actorId, action, entityType, entityId }], options);
}
