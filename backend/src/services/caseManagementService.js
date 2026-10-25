import crypto from 'node:crypto';
import { DisciplinaryCase } from '../models/DisciplinaryCase.js';
import { recordCaseCreation } from './caseHistoryService.js';

function newCaseNumber() {
  return `DC-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

export async function createInitialCase(incident, officerId, options = {}) {
  const [disciplinaryCase] = await DisciplinaryCase.create([{
    caseNumber: newCaseNumber(), incidentId: incident._id, studentId: incident.studentId,
    assignedOfficer: officerId, caseType: incident.subject, openedDate: new Date(), currentStatus: 'open',
  }], options);
  await recordCaseCreation({ caseId: disciplinaryCase._id, incidentId: incident._id, actorId: officerId }, options);
  return disciplinaryCase;
}
