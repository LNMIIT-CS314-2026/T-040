import mongoose from 'mongoose';

const disciplinaryCaseSchema = new mongoose.Schema({
  caseNumber: { type: String, required: true, unique: true, immutable: true },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, unique: true, immutable: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, immutable: true, index: true },
  assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caseType: { type: String, required: true, immutable: true },
  openedDate: { type: Date, required: true, immutable: true },
  currentStatus: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  closureDate: Date,
}, { timestamps: true, versionKey: false });

export const DisciplinaryCase = mongoose.model('DisciplinaryCase', disciplinaryCaseSchema);
