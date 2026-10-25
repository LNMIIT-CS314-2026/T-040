import 'dotenv/config';
import mongoose from 'mongoose';
import { Incident } from '../models/Incident.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before migrating incident fields.');

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const collection = Incident.collection;
  const renamed = await collection.updateMany(
    { category: { $exists: true }, subject: { $exists: false } },
    { $rename: { category: 'subject' }, $unset: { severity: '' } },
  );
  const cleaned = await collection.updateMany(
    { $or: [{ category: { $exists: true } }, { severity: { $exists: true } }] },
    { $unset: { category: '', severity: '' } },
  );
  console.log(`Migrated ${renamed.modifiedCount} incident subjects and removed legacy fields from ${cleaned.modifiedCount} incidents.`);
} finally {
  await mongoose.disconnect();
}
