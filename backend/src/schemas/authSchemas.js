import { z } from 'zod';
import { ROLE_VALUES } from '../domain/roles.js';

const institutionalEmail = z.string().trim().email().max(254).transform((value) => value.toLowerCase())
  .refine((value) => value.endsWith('@lnmiit.ac.in'), { message: 'Use your @lnmiit.ac.in email address.' });

export const loginSchema = z.object({
  email: institutionalEmail,
  password: z.string().min(1).max(200),
  role: z.enum(ROLE_VALUES),
}).strict();

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: institutionalEmail,
  password: z.string().min(12).max(200),
  role: z.enum(ROLE_VALUES),
  studentId: z.string().trim().min(1).max(80).optional(),
  department: z.string().trim().max(120).optional(),
}).strict().refine((user) => user.role !== 'student' || Boolean(user.studentId), {
  message: 'Student accounts require a student roll number.', path: ['studentId'],
});

export const updateUserSchema = z.object({
  role: z.enum(ROLE_VALUES).optional(),
  accountStatus: z.enum(['active', 'inactive']).optional(),
  studentId: z.string().trim().min(1).max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
