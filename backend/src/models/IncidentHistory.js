import mongoose from 'mongoose';

const incidentHistorySchema = new mongoose.Schema({
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, immutable: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  eventType: { type: String, required: true, immutable: true, maxlength: 80 },
  fromState: { type: String, immutable: true },
  toState: { type: String, immutable: true },
  reason: { type: String, immutable: true, maxlength: 2000 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

export const IncidentHistory = mongoose.model('IncidentHistory', incidentHistorySchema);
