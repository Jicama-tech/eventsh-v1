import * as dotenv from 'dotenv';
dotenv.config();
import { connect } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

async function seed() {
  const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eventsh_dev';
  await connect(MONGO);
  const User = (await import('../modules/users/schemas/user.schema')).User;
  const mongoose = await import('mongoose');
  const UserModel = mongoose.model('User', (await import('../modules/users/schemas/user.schema')).UserSchema);

  // Overridable so a fresh white-label deployment isn't stamped with the
  // same known admin login as every other eventsh instance. Falls back to
  // the original literal values so the existing eventsh.com deployment
  // (which has never set these) is unaffected.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@eventsh.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      'SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD not set — seeding the default admin login. ' +
        'Set both before first boot on a fresh (white-label) deployment.',
    );
  }

  const existing = await UserModel.findOne({ email: adminEmail }).exec();
  if (existing) {
    process.exit(0);
  }
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(adminPassword, salt);
  await UserModel.create({ email: adminEmail, password: hash, name: 'Admin', roles: ['admin'] });
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
