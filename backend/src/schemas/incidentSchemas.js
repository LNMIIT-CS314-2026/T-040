import { z } from 'zod';
import { shiftCalendarMonth } from '../domain/dateLimits.js';

const incidentDateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value))
  .refine((date) => date >= shiftCalendarMonth(new Date(), -1) && date <= new Date(), {
    message: 'Incident date must be within the past month and cannot be in the future.',
  });

export const submitIncidentSchema = z.object({
  studentId: z.string().trim().min(1).max(80),
  incidentDateTime,
  location: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(5000),
  evidenceDescription: z.string().trim().max(500).optional().transform((value) => value || undefined),
}).strict();

export const reviewIncidentSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin') }).strict(),
  z.object({ action: z.literal('accept') }).strict(),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(1).max(2000) }).strict(),
]);
