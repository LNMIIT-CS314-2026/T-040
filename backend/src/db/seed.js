import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { hashPassword } from '../auth/passwords.js';
import { ROLES } from '../domain/roles.js';

if (!process.env.MONGODB_URI || !process.env.SEED_PASSWORD) throw new Error('Set MONGODB_URI and SEED_PASSWORD before seeding.');
if (process.env.NODE_ENV === 'production') throw new Error('Seed data is disabled in production.');
if (process.env.SEED_PASSWORD.length < 12) throw new Error('SEED_PASSWORD must be at least 12 characters.');

await mongoose.connect(process.env.MONGODB_URI);
const passwordHash = await hashPassword(process.env.SEED_PASSWORD);
const demoUsers = [
  { name: 'Alex Morgan', email: 'admin@lnmiit.ac.in', role: ROLES.ADMIN },
  { name: 'Casey Rivera', email: 'student@lnmiit.ac.in', role: ROLES.STUDENT },
  { name: 'Jordan Lee', email: 'faculty@lnmiit.ac.in', role: ROLES.REPORTER, department: 'Computing' },
  { name: 'Taylor Quinn', email: 'officer@lnmiit.ac.in', role: ROLES.OFFICER, department: 'Student Affairs' },
];
for (const item of demoUsers) {
  await User.updateOne({ email: item.email }, { $set: { ...item, passwordHash, accountStatus: 'active' } }, { upsert: true, runValidators: true });
}
const studentUser = await User.findOne({ email: 'student@lnmiit.ac.in' });
const seededStudentProfile = await StudentProfile.findOne({ $or: [
  { userId: studentUser._id },
  { studentId: 'DEMO-STU-1001' },
 ] }).select('_id').lean();
await StudentProfile.updateOne(seededStudentProfile ? { _id: seededStudentProfile._id } : { userId: studentUser._id }, {
  $set: { userId: studentUser._id, studentId: '24ucs005', academicStatus: 'active' },
  $unset: { program: 1, department: 1, semester: 1 },
}, { upsert: true, runValidators: true });
for (const profile of [
  { previousId: 'DEMO-STU-1002', studentId: '23ece012' },
  { previousId: 'DEMO-STU-1003', studentId: '22me003' },
]) {
  const { previousId, studentId } = profile;
  await StudentProfile.updateOne({ studentId: { $in: [previousId, studentId] } }, {
    $set: { studentId }, $unset: { program: 1, department: 1, semester: 1 },
  }, { upsert: true, runValidators: true });
}
console.log(`Seeded ${demoUsers.length} fictional demo accounts and 3 fictional student profiles.`);
await mongoose.disconnect();
