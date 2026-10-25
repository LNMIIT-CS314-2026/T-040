export const INCIDENT_STATES = Object.freeze({
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  REVIEW: 'Under Initial Review',
  CONVERTED: 'Converted to Case',
  REJECTED: 'Rejected/Closed',
  FINAL: 'Final',
});

export const INCIDENT_OUTCOMES = Object.freeze({
  CONVERTED: 'converted_to_case',
  REJECTED: 'rejected_closed',
});

const transitions = new Map([
  [INCIDENT_STATES.DRAFT, new Set([INCIDENT_STATES.SUBMITTED])],
  [INCIDENT_STATES.SUBMITTED, new Set([INCIDENT_STATES.REVIEW])],
  [INCIDENT_STATES.REVIEW, new Set([INCIDENT_STATES.CONVERTED, INCIDENT_STATES.REJECTED])],
  [INCIDENT_STATES.CONVERTED, new Set([INCIDENT_STATES.FINAL])],
  [INCIDENT_STATES.REJECTED, new Set([INCIDENT_STATES.FINAL])],
  [INCIDENT_STATES.FINAL, new Set()],
]);

export function canTransitionIncident(from, to) {
  return transitions.get(from)?.has(to) ?? false;
}
