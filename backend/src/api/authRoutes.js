import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { loginSchema } from '../schemas/authSchemas.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { verifyPassword } from '../auth/passwords.js';
import { requireAuth } from '../auth/access.js';

export const authRoutes = Router();

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 10 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

authRoutes.post('/login', loginLimit, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter an @lnmiit.ac.in email, password, and role.' });
    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
    const valid = user && user.accountStatus === 'active' && await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Email or password is incorrect.' });
    if (user.role !== parsed.data.role) return res.status(403).json({ error: `This account is registered as ${user.role.replaceAll('_', ' ')}. Select that role and try again.` });

    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    if (user.role === 'student') {
      const profile = await StudentProfile.findOne({ userId: user._id }, 'studentId').lean();
      if (profile) sessionUser.studentId = profile.studentId;
    }
    req.session.user = sessionUser;
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    return res.json({ user: req.session.user });
  } catch (error) {
    return next(error);
  }
});

authRoutes.post('/logout', requireAuth, async (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie(req.sessionCookieName || 't040.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    return res.status(204).end();
  });
});

authRoutes.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
