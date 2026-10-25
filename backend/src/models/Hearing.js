import mongoose from 'mongoose';

const hearingSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DisciplinaryCase', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
  scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledAt: { type: Date, required: true },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled', index: true },
  proceedings: { type: String, trim: true, maxlength: 5000 },
  completedAt: Date,
}, { timestamps: true, versionKey: false });

hearingSchema.index({ studentId: 1, scheduledAt: 1 });

export const Hearing = mongoose.model('Hearing', hearingSchema);
