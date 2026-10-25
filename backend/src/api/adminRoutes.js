import { Router } from 'express';
import { requireRole } from '../auth/access.js';
import { ROLES } from '../domain/roles.js';
import { createUserSchema, updateUserSchema } from '../schemas/authSchemas.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { hashPassword } from '../auth/passwords.js';
import { appendAudit } from '../services/auditService.js';

export const adminRoutes = Router();
adminRoutes.use(requireRole(ROLES.ADMIN));

adminRoutes.get('/users', async (req, res, next) => {
  try {
    const users = await User.find({}, 'name email role accountStatus department createdAt').sort({ createdAt: -1 }).lean();
    return res.json({ users });
  } catch (error) { return next(error); }
});

adminRoutes.post('/users', async (req, res, next) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Check the user fields and try again.', fields: parsed.error.flatten().fieldErrors });
  let createdUser;
  try {
    createdUser = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      ...(parsed.data.department ? { department: parsed.data.department } : {}),
      passwordHash: await hashPassword(parsed.data.password),
    });
    if (parsed.data.role === ROLES.STUDENT) {
      await StudentProfile.create({
        userId: createdUser._id,
        studentId: parsed.data.studentId,
      });
    }
    await appendAudit({ actorId: req.user.id, action: 'user.created', entityType: 'User', entityId: createdUser.id });
    return res.status(201).json({ user: {
      id: createdUser.id, name: createdUser.name, email: createdUser.email, role: createdUser.role,
      accountStatus: createdUser.accountStatus,
    } });
  } catch (error) {
    if (createdUser) {
      await StudentProfile.deleteOne({ userId: createdUser._id });
      await User.deleteOne({ _id: createdUser._id });
    }
    if (error?.code === 11000) return res.status(409).json({ error: 'A user with that email or student roll number already exists.' });
    return next(error);
  }
});

adminRoutes.patch('/users/:id', async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid user identifier.' });
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a valid role or account status.' });
  if (req.params.id === req.user.id && (parsed.data.role !== undefined || parsed.data.accountStatus === 'inactive')) {
    return res.status(400).json({ error: 'You cannot remove your own administrator access.' });
  }
  if (parsed.data.role === ROLES.STUDENT && !parsed.data.studentId) {
    return res.status(400).json({ error: 'Provide the existing student roll number when assigning the Student role.' });
  }
  try {
    const current = await User.findById(req.params.id);
    if (!current) throw Object.assign(new Error('USER_NOT_FOUND'), { code: 'USER_NOT_FOUND' });
    const { studentId, ...changes } = parsed.data;
    if (changes.role === ROLES.STUDENT && current.role !== ROLES.STUDENT) {
      const profile = await StudentProfile.findOne({ studentId });
      if (!profile) throw Object.assign(new Error('STUDENT_PROFILE_NOT_FOUND'), { code: 'STUDENT_PROFILE_NOT_FOUND' });
      if (profile.userId && String(profile.userId) !== String(current._id)) {
        throw Object.assign(new Error('STUDENT_PROFILE_LINKED'), { code: 'STUDENT_PROFILE_LINKED' });
      }
      profile.userId = current._id;
      await profile.save();
    }
    if (current.role === ROLES.STUDENT && changes.role && changes.role !== ROLES.STUDENT) {
      await StudentProfile.updateOne({ userId: current._id }, { $unset: { userId: 1 } });
    }
    const updated = await User.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true });
    await appendAudit({ actorId: req.user.id, action: 'user.updated', entityType: 'User', entityId: updated.id });
    return res.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, accountStatus: updated.accountStatus } });
  } catch (error) {
    if (error?.code === 'USER_NOT_FOUND') return res.status(404).json({ error: 'User not found.' });
    if (error?.code === 'STUDENT_PROFILE_NOT_FOUND') return res.status(404).json({ error: 'Student profile not found.' });
    if (error?.code === 'STUDENT_PROFILE_LINKED') return res.status(409).json({ error: 'That student profile is already linked to an account.' });
    return next(error);
  }
});

adminRoutes.get('/audit', async (req, res, next) => {
  try {
    const { AuditLog } = await import('../models/AuditLog.js');
    const entries = await AuditLog.find().sort({ createdAt: -1 }).limit(100)
      .populate('actorId', 'name email role').lean();
    return res.json({ entries });
  } catch (error) { return next(error); }
});
