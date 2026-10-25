import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './api/app.js';

const required = ['MONGODB_URI', 'SESSION_SECRET', 'CLIENT_ORIGIN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment setting: ${key}`);
}
if (process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');

await mongoose.connect(process.env.MONGODB_URI);
const port = Number(process.env.PORT ?? 4000);
const app = createApp();
const server = app.listen(port, '127.0.0.1', () => console.log(`API listening on 127.0.0.1:${port}`));

async function shutdown() {
  server.close(async () => {
    await app.get('sessionStore').close();
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
