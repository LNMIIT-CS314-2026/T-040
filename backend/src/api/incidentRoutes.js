import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/access.js';
import { ROLES } from '../domain/roles.js';
import { submitIncidentSchema, reviewIncidentSchema } from '../schemas/incidentSchemas.js';
import { getIncidentForUser, IncidentServiceError, listIncidentsForUser, reviewIncident, submitIncident } from '../services/incidentService.js';

export const incidentRoutes = Router();
incidentRoutes.use(requireAuth);

incidentRoutes.get('/', requireRole(ROLES.REPORTER, ROLES.OFFICER), async (req, res, next) => {
  try { return res.json({ incidents: await listIncidentsForUser(req.user) }); }
  catch (error) { return next(error); }
});

incidentRoutes.post('/', requireRole(ROLES.REPORTER), async (req, res, next) => {
  const parsed = submitIncidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Complete the required incident fields and try again.', fields: parsed.error.flatten().fieldErrors });
  try {
    const incident = await submitIncident(req.user.id, parsed.data);
    return res.status(201).json({ incident, confirmation: 'Incident report submitted successfully.' });
  } catch (error) { return next(error); }
});

incidentRoutes.get('/:id', requireRole(ROLES.REPORTER, ROLES.OFFICER), async (req, res, next) => {
  try { return res.json({ incident: await getIncidentForUser(req.params.id, req.user) }); }
  catch (error) { return next(error); }
});

incidentRoutes.post('/:id/review', requireRole(ROLES.OFFICER), async (req, res, next) => {
  const parsed = reviewIncidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid review action. Rejection requires a reason.', fields: parsed.error.flatten().fieldErrors });
  try {
    const result = await reviewIncident(req.params.id, req.user.id, parsed.data);
    return res.json({ review: result });
  } catch (error) { return next(error); }
});
