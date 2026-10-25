import { Notification } from '../models/Notification.js';
import { ROLES } from '../domain/roles.js';

export function queueIncidentForReview(incident, options = {}) {
  return Notification.create([{
    recipientRole: ROLES.OFFICER,
    notificationType: 'incident.submitted',
    entityType: 'Incident',
    entityId: incident.id,
    message: `Incident ${incident.incidentId} is ready for initial review.`,
  }], options);
}

export function notifyReporter(reporterId, incident, notificationType, options = {}) {
  return Notification.create([{
    recipientUserId: reporterId,
    notificationType,
    entityType: 'Incident',
    entityId: incident.id,
    message: `Incident ${incident.incidentId} has an updated review status.`,
  }], options);
}
