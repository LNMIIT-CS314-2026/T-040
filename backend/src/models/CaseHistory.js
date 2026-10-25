import mongoose from 'mongoose';

const caseHistorySchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DisciplinaryCase', required: true, immutable: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  eventType: { type: String, required: true, immutable: true, maxlength: 80 },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

export const CaseHistory = mongoose.model('CaseHistory', caseHistorySchema);
