import mongoose from 'mongoose';

const studentProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
  studentId: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  academicStatus: { type: String, trim: true, maxlength: 40, default: 'active' },
}, { timestamps: true, versionKey: false });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
