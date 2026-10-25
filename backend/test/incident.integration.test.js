import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/api/app.js';
import { User } from '../src/models/User.js';
import { StudentProfile } from '../src/models/StudentProfile.js';
import { Incident } from '../src/models/Incident.js';
import { Evidence } from '../src/models/Evidence.js';
import { DisciplinaryCase } from '../src/models/DisciplinaryCase.js';
import { IncidentHistory } from '../src/models/IncidentHistory.js';
import { CaseHistory } from '../src/models/CaseHistory.js';
import { Notification } from '../src/models/Notification.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { ROLES } from '../src/domain/roles.js';
import { hashPassword } from '../src/auth/passwords.js';

const testMongoUri = process.env.TEST_MONGODB_URI;

test('UC-003 API submission, authorization, review, and compensated case creation', { skip: !testMongoUri }, async (t) => {
  const databaseName = new URL(testMongoUri).pathname.replace(/^\//, '').split('?')[0];
  assert.match(databaseName.toLowerCase(), /test/, 'TEST_MONGODB_URI must target a database with "test" in its name');
  process.env.MONGODB_URI = testMongoUri;
  process.env.SESSION_SECRET ||= crypto.randomBytes(48).toString('hex');
  process.env.CLIENT_ORIGIN ||= 'http://127.0.0.1:5173';
  await mongoose.connect(testMongoUri);

  const token = crypto.randomUUID();
  const password = 'Fictional-Test-Password-46!';
  const passwordHash = await hashPassword(password);
  const users = await User.create([
    { name: 'Test Reporter', email: `reporter-${token}@lnmiit.ac.in`, role: ROLES.REPORTER, passwordHash },
    { name: 'Other Reporter', email: `other-${token}@lnmiit.ac.in`, role: ROLES.REPORTER, passwordHash },
    { name: 'Test Student', email: `student-${token}@lnmiit.ac.in`, role: ROLES.STUDENT, passwordHash },
    { name: 'Test Officer', email: `officer-${token}@lnmiit.ac.in`, role: ROLES.OFFICER, passwordHash },
    { name: 'Test Admin', email: `admin-${token}@lnmiit.ac.in`, role: ROLES.ADMIN, passwordHash },
  ]);
  const userIds = users.map((user) => user._id);
  const studentIds = [`TEST-${token}-1`, `TEST-${token}-2`];
  const profiles = await StudentProfile.create([
    { userId: users[2]._id, studentId: studentIds[0] },
    { studentId: studentIds[1] },
  ]);
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = {};
  const origin = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173').split(',')[0].trim();

  async function call(path, { actor, method = 'GET', body } = {}) {
    const headers = { origin };
    if (actor) headers.cookie = cookies[actor];
    if (body) headers['content-type'] = 'application/json';
    const response = await fetch(`${base}/api${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = response.status === 204 ? null : await response.json();
    return { response, data };
  }
  async function login(actor, user) {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password, role: user.role }),
    });
    assert.equal(response.status, 200);
    cookies[actor] = response.headers.getSetCookie()[0].split(';')[0];
  }

  try {
    await login('reporter', users[0]);
    await login('other', users[1]);
    await login('student', users[2]);
    await login('officer', users[3]);
    await login('admin', users[4]);

    const unauthenticated = await call('/incidents');
    assert.equal(unauthenticated.response.status, 401);
    assert.equal((await call('/incidents', { actor: 'student' })).response.status, 403);
    assert.equal((await call('/incidents', { actor: 'admin' })).response.status, 403);

    const requiredFieldFailure = await call('/incidents', { actor: 'reporter', method: 'POST', body: { studentId: studentIds[0] } });
    assert.equal(requiredFieldFailure.response.status, 400);
    assert.ok(requiredFieldFailure.data.fields.incidentDateTime);
    const invalidStudent = await call('/incidents', { actor: 'reporter', method: 'POST', body: {
      studentId: 'NO-SUCH-STUDENT', incidentDateTime: '2026-10-05T12:30:00.000Z', location: 'Room X', subject: 'Conduct', description: 'Fictional report.',
    } });
    assert.equal(invalidStudent.response.status, 400);

    const submission = await call('/incidents', { actor: 'reporter', method: 'POST', body: {
      studentId: studentIds[0], incidentDateTime: '2026-10-05T12:30:00.000Z', location: 'Test room A',
      subject: 'Fictional subject', description: 'Fictional integration-test report.', evidenceDescription: 'Fictional metadata note.',
    } });
    assert.equal(submission.response.status, 201);
    const incident = submission.data.incident;
    assert.match(incident.incidentId, /^IN-\d{4}-[A-F\d]+$/);
    assert.equal(incident.status, 'Submitted');
    assert.equal((await Evidence.countDocuments({ incidentId: incident.id })).valueOf(), 1);

    const otherReporterRead = await call(`/incidents/${incident.id}`, { actor: 'other' });
    assert.equal(otherReporterRead.response.status, 404);
    const queue = await call('/incidents', { actor: 'officer' });
    assert.equal(queue.response.status, 200);
    assert.ok(queue.data.incidents.some((item) => item.id === incident.id));
    assert.equal((await call(`/incidents/${incident.id}`, { actor: 'student' })).response.status, 403);
    assert.equal((await call(`/incidents/${incident.id}/review`, { actor: 'reporter', method: 'POST', body: { action: 'begin' } })).response.status, 403);

    const skippedState = await call(`/incidents/${incident.id}/review`, { actor: 'officer', method: 'POST', body: { action: 'accept' } });
    assert.equal(skippedState.response.status, 409);
    const began = await call(`/incidents/${incident.id}/review`, { actor: 'officer', method: 'POST', body: { action: 'begin' } });
    assert.equal(began.response.status, 200);
    assert.equal(began.data.review.status, 'Under Initial Review');
    const accepted = await call(`/incidents/${incident.id}/review`, { actor: 'officer', method: 'POST', body: { action: 'accept' } });
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.data.review.outcome, 'converted_to_case');
    assert.equal(accepted.data.review.status, 'Final');
    assert.equal(await DisciplinaryCase.countDocuments({ incidentId: incident.id }), 1);
    const repeatedAcceptance = await call(`/incidents/${incident.id}/review`, { actor: 'officer', method: 'POST', body: { action: 'accept' } });
    assert.equal(repeatedAcceptance.response.status, 409);
    const reporterDetail = await call(`/incidents/${incident.id}`, { actor: 'reporter' });
    assert.equal(reporterDetail.data.incident.caseNumber, accepted.data.review.caseNumber);

    const failureSubmission = await call('/incidents', { actor: 'reporter', method: 'POST', body: {
      studentId: studentIds[1], incidentDateTime: '2026-10-06T14:30:00.000Z', location: 'Test room C',
      subject: 'Fictional subject', description: 'Fictional case cleanup report.',
    } });
    assert.equal(failureSubmission.response.status, 201);
    const failureId = failureSubmission.data.incident.id;
    await call(`/incidents/${failureId}/review`, { actor: 'officer', method: 'POST', body: { action: 'begin' } });
    const originalCaseHistoryCreate = CaseHistory.create;
    CaseHistory.create = async function (documents, options) {
      if (String(documents[0]?.incidentId) === failureId) throw new Error('Simulated history persistence failure.');
      return originalCaseHistoryCreate.call(this, documents, options);
    };
    try {
      const failedAcceptance = await call(`/incidents/${failureId}/review`, { actor: 'officer', method: 'POST', body: { action: 'accept' } });
      assert.equal(failedAcceptance.response.status, 500);
    } finally { CaseHistory.create = originalCaseHistoryCreate; }
    assert.equal(await DisciplinaryCase.countDocuments({ incidentId: failureId }), 0);
    assert.equal(await IncidentHistory.countDocuments({ incidentId: failureId }), 2);
    assert.equal(await AuditLog.countDocuments({ entityType: 'Incident', entityId: failureId }), 2);
    const failureDetail = await call(`/incidents/${failureId}`, { actor: 'reporter' });
    assert.equal(failureDetail.data.incident.status, 'Under Initial Review');

    const rejectedSubmission = await call('/incidents', { actor: 'reporter', method: 'POST', body: {
      studentId: studentIds[1], incidentDateTime: '2026-10-06T12:30:00.000Z', location: 'Test room B',
      subject: 'Fictional subject', description: 'Another fictional report.',
    } });
    assert.equal(rejectedSubmission.response.status, 201);
    const rejectedId = rejectedSubmission.data.incident.id;
    await call(`/incidents/${rejectedId}/review`, { actor: 'officer', method: 'POST', body: { action: 'begin' } });
    const missingReason = await call(`/incidents/${rejectedId}/review`, { actor: 'officer', method: 'POST', body: { action: 'reject' } });
    assert.equal(missingReason.response.status, 400);
    const rejected = await call(`/incidents/${rejectedId}/review`, { actor: 'officer', method: 'POST', body: { action: 'reject', reason: 'Fictional test reason.' } });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.data.review.outcome, 'rejected_closed');
    assert.equal(await DisciplinaryCase.countDocuments({ incidentId: rejectedId }), 0);

    assert.equal(await IncidentHistory.countDocuments({ incidentId: incident.id }), 4);
    assert.equal(await CaseHistory.countDocuments({ incidentId: incident.id }), 1);
    assert.equal(await AuditLog.countDocuments({ actorId: users[0]._id, entityType: 'Incident' }), 2);
    assert.equal(await Notification.countDocuments({ entityId: incident.id, recipientRole: ROLES.OFFICER }), 1);
    assert.equal(await Notification.countDocuments({ entityId: incident.id, recipientUserId: users[0]._id }), 2);
    assert.equal(await Incident.countDocuments({ reporterId: users[0]._id }), 2);
    assert.equal(await Incident.countDocuments({ incidentId: incident.incidentId }), 1);
    t.diagnostic('UC-003 submission and review flow passed against MongoDB.');
  } finally {
    for (const cookie of Object.values(cookies)) {
      if (cookie) await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { origin, cookie } }).catch(() => {});
    }
    const incidentDocs = await Incident.find({ reporterId: { $in: userIds } }, '_id').lean();
    const incidentObjectIds = incidentDocs.map((item) => item._id);
    const incidentIdStrings = incidentObjectIds.map(String);
    await Promise.all([
      IncidentHistory.deleteMany({ incidentId: { $in: incidentObjectIds } }),
      Evidence.deleteMany({ incidentId: { $in: incidentObjectIds } }),
      CaseHistory.deleteMany({ incidentId: { $in: incidentObjectIds } }),
      DisciplinaryCase.deleteMany({ incidentId: { $in: incidentObjectIds } }),
      Notification.deleteMany({ entityId: { $in: incidentIdStrings } }),
      AuditLog.deleteMany({ actorId: { $in: userIds } }),
      Incident.deleteMany({ _id: { $in: incidentObjectIds } }),
      StudentProfile.deleteMany({ _id: { $in: profiles.map((profile) => profile._id) } }),
      User.deleteMany({ _id: { $in: userIds } }),
    ]);
    await new Promise((resolve) => server.close(resolve));
    await app.get('sessionStore').close();
    await mongoose.disconnect();
  }
});
