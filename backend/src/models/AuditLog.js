import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  action: { type: String, required: true, immutable: true, maxlength: 80 },
  entityType: { type: String, required: true, immutable: true, maxlength: 80 },
  entityId: { type: String, required: true, immutable: true, maxlength: 80 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: 'throw' });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
