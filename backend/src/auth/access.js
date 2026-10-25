import { ROLE_VALUES } from '../domain/roles.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';

export function hasRole(user, allowedRoles) {
  return Boolean(user && ROLE_VALUES.includes(user.role) && allowedRoles.includes(user.role));
}

async function loadActiveUser(req, res) {
  if (!req.session?.user?.id) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  const account = await User.findById(req.session.user.id, 'name email role accountStatus').lean();
  if (!account || account.accountStatus !== 'active' || !ROLE_VALUES.includes(account.role)) {
    req.session.destroy(() => {});
    res.clearCookie(req.sessionCookieName || 't040.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  req.user = {
    id: String(account._id), name: account.name, email: account.email, role: account.role,
  };
  if (account.role === 'student') {
    const profile = await StudentProfile.findOne({ userId: account._id }, 'studentId').lean();
    if (profile) req.user.studentId = profile.studentId;
  }
  req.session.user = req.user;
  return req.user;
}

export async function requireAuth(req, res, next) {
  try {
    if (!await loadActiveUser(req, res)) return;
    return next();
  } catch (error) { return next(error); }
}

export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!await loadActiveUser(req, res)) return;
      if (!hasRole(req.user, allowedRoles)) return res.status(403).json({ error: 'You are not allowed to perform this action.' });
      return next();
    } catch (error) { return next(error); }
  };
}
