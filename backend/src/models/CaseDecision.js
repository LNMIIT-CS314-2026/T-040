import mongoose from 'mongoose';

const caseDecisionSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DisciplinaryCase', required: true, unique: true, index: true },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  finding: { type: String, enum: ['responsible', 'not_responsible', 'inconclusive'], required: true },
  rationale: { type: String, required: true, trim: true, maxlength: 5000 },
  decidedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true, versionKey: false });

export const CaseDecision = mongoose.model('CaseDecision', caseDecisionSchema);
