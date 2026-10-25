import test from 'node:test';
import assert from 'node:assert/strict';
import { INCIDENT_STATES as S, canTransitionIncident } from '../src/domain/incidentStates.js';
import { submitIncidentSchema, reviewIncidentSchema } from '../src/schemas/incidentSchemas.js';

test('incident lifecycle permits only the source-defined transitions', () => {
  assert.equal(canTransitionIncident(S.DRAFT, S.SUBMITTED), true);
  assert.equal(canTransitionIncident(S.SUBMITTED, S.REVIEW), true);
  assert.equal(canTransitionIncident(S.REVIEW, S.CONVERTED), true);
  assert.equal(canTransitionIncident(S.REVIEW, S.REJECTED), true);
  assert.equal(canTransitionIncident(S.CONVERTED, S.FINAL), true);
  assert.equal(canTransitionIncident(S.REJECTED, S.FINAL), true);
  assert.equal(canTransitionIncident(S.DRAFT, S.CONVERTED), false);
  assert.equal(canTransitionIncident(S.SUBMITTED, S.FINAL), false);
  assert.equal(canTransitionIncident(S.FINAL, S.REVIEW), false);
});

test('incident submission schema requires all mandated fields and a valid datetime', () => {
  const valid = {
    studentId: 'DEMO-STU-1001', incidentDateTime: '2026-10-01T12:30:00.000Z',
    location: 'Campus room A', subject: 'Conduct', description: 'Fictional test report.',
  };
  const parsed = submitIncidentSchema.safeParse(valid);
  assert.equal(parsed.success, true);
  assert.ok(parsed.data.incidentDateTime instanceof Date);
  assert.equal(submitIncidentSchema.safeParse({ ...valid, studentId: ' ' }).success, false);
  assert.equal(submitIncidentSchema.safeParse({ ...valid, description: '' }).success, false);
  assert.equal(submitIncidentSchema.safeParse({ ...valid, incidentDateTime: 'not-a-date' }).success, false);
});

test('rejection requires a recorded reason and review payloads reject unknown fields', () => {
  assert.equal(reviewIncidentSchema.safeParse({ action: 'reject' }).success, false);
  assert.equal(reviewIncidentSchema.safeParse({ action: 'reject', reason: 'Insufficient information.' }).success, true);
  assert.equal(reviewIncidentSchema.safeParse({ action: 'accept', reason: 'extra' }).success, false);
  assert.equal(reviewIncidentSchema.safeParse({ action: 'begin' }).success, true);
});
