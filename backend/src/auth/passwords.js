import bcrypt from 'bcryptjs';

const WORK_FACTOR = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, WORK_FACTOR);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
