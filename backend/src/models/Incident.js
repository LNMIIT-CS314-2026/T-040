import mongoose from 'mongoose';
import { INCIDENT_OUTCOMES, INCIDENT_STATES } from '../domain/incidentStates.js';

const incidentSchema = new mongoose.Schema({
  incidentId: { type: String, required: true, unique: true, immutable: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, immutable: true, index: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
  incidentDateTime: { type: Date, required: true, immutable: true },
  location: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
  subject: { type: String, required: true, trim: true, maxlength: 100, immutable: true },
  description: { type: String, required: true, trim: true, maxlength: 5000, immutable: true },
  reportedDate: { type: Date, required: true, immutable: true },
  status: { type: String, enum: Object.values(INCIDENT_STATES), required: true, index: true },
  outcome: { type: String, enum: Object.values(INCIDENT_OUTCOMES) },
  reviewReason: { type: String, trim: true, maxlength: 2000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DisciplinaryCase' },
}, { timestamps: true, versionKey: false });

incidentSchema.index({ reporterId: 1, reportedDate: -1 });
incidentSchema.index({ status: 1, reportedDate: -1 });

export const Incident = mongoose.model('Incident', incidentSchema);
