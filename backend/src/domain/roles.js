export const ROLES = Object.freeze({
  ADMIN: 'administrator',
  STUDENT: 'student',
  REPORTER: 'reporting_staff',
  OFFICER: 'discipline_officer',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.STUDENT]: 'Student',
  [ROLES.REPORTER]: 'Faculty / Reporting Staff',
  [ROLES.OFFICER]: 'Discipline Officer / Committee',
});
