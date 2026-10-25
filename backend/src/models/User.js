import mongoose from 'mongoose';
import { ROLE_VALUES } from '../domain/roles.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLE_VALUES, required: true, index: true },
  accountStatus: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  department: { type: String, trim: true, maxlength: 120 },
}, { timestamps: true, versionKey: false });

export const User = mongoose.model('User', userSchema);
