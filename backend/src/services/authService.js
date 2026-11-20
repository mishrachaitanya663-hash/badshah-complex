import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { authRepository } from '../repositories/authRepository.js';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, expected] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actual.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actual, expectedBuffer);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function ensureAdmin() {
  const username = config.adminUsername;
  const admin = await authRepository.findAdminByUsername(username);
  if (!admin) {
    await authRepository.createAdmin({
      id: crypto.randomUUID(),
      username,
      passwordHash: hashPassword(config.adminPassword),
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
    console.log(`[auth] Created admin "${username}" from .env`);
    return;
  }
  if (!verifyPassword(config.adminPassword, admin.passwordHash)) {
    await authRepository.updateAdminPassword(admin.id, hashPassword(config.adminPassword));
    console.log(`[auth] Updated admin "${username}" password from .env`);
  }
}

export async function login({ username, password }) {
  const admin = await authRepository.findAdminByUsername(username);
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    throw new HttpError(401, 'Invalid username or password');
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlHours * 60 * 60 * 1000).toISOString();
  await authRepository.createSession({
    tokenHash: hashToken(token),
    adminId: admin.id,
    expiresAt,
    createdAt: now.toISOString(),
  });
  await authRepository.deleteExpiredSessions(now.toISOString());

  return {
    token,
    expiresAt,
    admin: { id: admin.id, username: admin.username, role: admin.role },
  };
}

export async function resolveSession(token) {
  if (!token) return null;
  const session = await authRepository.findSession(hashToken(token));
  if (!session) return null;
  if (session.expiresAt <= new Date().toISOString()) {
    await authRepository.deleteSession(session.tokenHash);
    return null;
  }
  return session;
}

export async function logout(token) {
  if (!token) return;
  await authRepository.deleteSession(hashToken(token));
}
