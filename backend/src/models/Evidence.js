import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema({
  evidenceId: { type: String, required: true, unique: true, immutable: true },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, immutable: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  description: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
  uploadTimestamp: { type: Date, required: true, immutable: true },
  accessClassification: { type: String, enum: ['restricted'], default: 'restricted', immutable: true },
}, { versionKey: false });

export const Evidence = mongoose.model('Evidence', evidenceSchema);
