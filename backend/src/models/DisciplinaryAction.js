import mongoose from 'mongoose';

const disciplinaryActionSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DisciplinaryCase', required: true, index: true },
  decisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CaseDecision', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
  type: { type: String, enum: ['warning', 'suspension', 'other'], required: true },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  dueDate: Date,
  status: { type: String, enum: ['completed'], default: 'completed', index: true },
  resolvedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, versionKey: false });

export const DisciplinaryAction = mongoose.model('DisciplinaryAction', disciplinaryActionSchema);
