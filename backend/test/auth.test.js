import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLE_VALUES } from '../src/domain/roles.js';
import { hasRole } from '../src/auth/access.js';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { createUserSchema, loginSchema } from '../src/schemas/authSchemas.js';

test('the four approved MVP roles are explicit and stable', () => {
  assert.deepEqual(ROLE_VALUES, ['administrator', 'student', 'reporting_staff', 'discipline_officer']);
  assert.equal(Object.keys(ROLES).length, 4);
});

test('role authorization denies missing, unknown and unrelated roles', () => {
  assert.equal(hasRole(null, [ROLES.ADMIN]), false);
  assert.equal(hasRole({ role: 'institute_management' }, [ROLES.ADMIN]), false);
  assert.equal(hasRole({ role: ROLES.STUDENT }, [ROLES.OFFICER]), false);
  assert.equal(hasRole({ role: ROLES.OFFICER }, [ROLES.OFFICER]), true);
});

test('passwords are salted hashes and verify only the matching password', async () => {
  const firstHash = await hashPassword('fictional-demo-password');
  const secondHash = await hashPassword('fictional-demo-password');
  assert.notEqual(firstHash, 'fictional-demo-password');
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword('fictional-demo-password', firstHash), true);
  assert.equal(await verifyPassword('incorrect-password', firstHash), false);
});

test('login input is normalized and malformed credentials fail validation', () => {
  const valid = { email: '  STAFF@LNMIIT.AC.IN ', password: 'safe-demo', role: ROLES.REPORTER };
  assert.equal(loginSchema.parse(valid).email, 'staff@lnmiit.ac.in');
  assert.equal(loginSchema.safeParse({ ...valid, email: 'not-an-email' }).success, false);
  assert.equal(loginSchema.safeParse({ ...valid, email: 'staff@example.test' }).success, false);
  assert.equal(loginSchema.safeParse({ email: valid.email, password: valid.password }).success, false);
});

test('student user schema requires an identifier and rejects an unapproved role', () => {
  const base = { name: 'Demo Student', email: 'student@lnmiit.ac.in', password: 'long-demo-password', role: ROLES.STUDENT };
  assert.equal(createUserSchema.safeParse(base).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, studentId: 'DEMO-1' }).success, true);
  assert.equal(createUserSchema.safeParse({ ...base, role: 'management' }).success, false);
});
