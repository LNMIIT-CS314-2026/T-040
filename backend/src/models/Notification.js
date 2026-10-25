import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipientRole: { type: String },
  notificationType: { type: String, required: true, maxlength: 80 },
  entityType: { type: String, required: true, maxlength: 80 },
  entityId: { type: String, required: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 240 },
  deliveryStatus: { type: String, enum: ['queued', 'delivered'], default: 'queued' },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

notificationSchema.index({ recipientRole: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
