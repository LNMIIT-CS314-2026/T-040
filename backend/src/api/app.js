import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import { authRoutes } from './authRoutes.js';
import { adminRoutes } from './adminRoutes.js';
import { studentRoutes } from './studentRoutes.js';
import { incidentRoutes } from './incidentRoutes.js';
import { caseRoutes } from './caseRoutes.js';
import { IncidentServiceError } from '../services/incidentService.js';

export function createApp() {
  const app = express();
  const sessionStore = MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions', ttl: 8 * 60 * 60 });
  app.set('sessionStore', sessionStore);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (process.env.NODE_ENV !== 'production') return next();
    const origin = req.get('origin');
    const allowedOrigins = new Set((process.env.CLIENT_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean));
    if (!allowedOrigins.has(origin)) return res.status(403).json({ error: 'Request origin is not allowed.' });
    return next();
  });
  const sessionMiddlewares = new Map();
  app.use((req, res, next) => {
    const clientHost = req.get('x-t040-dev-client') || req.get('host') || 'local';
    const cookieName = process.env.NODE_ENV === 'production'
      ? 't040.sid'
      : `t040.sid.${clientHost.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    req.sessionCookieName = cookieName;
    let sessionMiddleware = sessionMiddlewares.get(cookieName);
    if (!sessionMiddleware) {
      sessionMiddleware = session({
        name: cookieName,
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: sessionStore,
        cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000, path: '/' },
      });
      sessionMiddlewares.set(cookieName, sessionMiddleware);
    }
    return sessionMiddleware(req, res, next);
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api/cases', caseRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof IncidentServiceError) return res.status(error.status).json({ error: error.message });
    if (process.env.NODE_ENV !== 'production') console.error({ name: error?.name, code: error?.code });
    return res.status(500).json({ error: 'The request could not be completed.' });
  });
  return app;
}
