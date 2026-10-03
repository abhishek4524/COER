import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Run from '../src/models/Run.js';
import Session from '../src/models/Session.js';
import Persona from '../src/models/Persona.js';

export async function runMigration() {
  await connectDB();

  console.log('[migration] Checking unassigned runs...');

  let devUser = await User.findOne({ email: 'dev@personify.local' });
  if (!devUser) {
    const passwordHash = await bcrypt.hash('devpassword123', 12);
    devUser = await User.create({
      name: 'Default Dev User',
      email: 'dev@personify.local',
      passwordHash,
      emailVerified: true,
      role: 'admin',
      plan: 'pro',
    });
    console.log(`[migration] Created default dev user: dev@personify.local (id: ${devUser._id})`);
  }

  const runsToUpdate = await Run.find({ $or: [{ userId: { $exists: false } }, { userId: null }] });
  if (runsToUpdate.length > 0) {
    const runResult = await Run.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { userId: devUser._id }
    );
    console.log(`[migration] Assigned ${runResult.modifiedCount} unassigned runs to default dev user.`);
  }

  const sessionsToUpdate = await Session.find({ $or: [{ userId: { $exists: false } }, { userId: null }] });
  if (sessionsToUpdate.length > 0) {
    const sessionResult = await Session.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { userId: devUser._id }
    );
    console.log(`[migration] Assigned ${sessionResult.modifiedCount} unassigned sessions to default dev user.`);
  }

  const personasToUpdate = await Persona.find({ isCustom: true, $or: [{ userId: { $exists: false } }, { userId: null }] });
  if (personasToUpdate.length > 0) {
    const personaResult = await Persona.updateMany(
      { isCustom: true, $or: [{ userId: { $exists: false } }, { userId: null }] },
      { userId: devUser._id }
    );
    console.log(`[migration] Assigned ${personaResult.modifiedCount} custom personas to default dev user.`);
  }

  console.log('[migration] Data migration check complete.');
  return devUser;
}

// Execute if run directly
const mainScript = process.argv[1]?.replace(/\\/g, '/');
if (mainScript && import.meta.url.endsWith(mainScript)) {
  runMigration().then(() => process.exit(0)).catch((err) => {
    console.error('[migration] Migration failed:', err);
    process.exit(1);
  });
}
