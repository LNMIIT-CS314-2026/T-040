import crypto from 'node:crypto';
import { Evidence } from '../models/Evidence.js';

export function createEvidenceReference(incidentId, uploadedBy, description, options = {}) {
  return Evidence.create([{
    evidenceId: `EV-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    incidentId, uploadedBy, description, uploadTimestamp: new Date(), accessClassification: 'restricted',
  }], options);
}
