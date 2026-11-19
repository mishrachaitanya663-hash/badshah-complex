import { getDb } from '../db/sqlite.js';

function toAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export async function countAdmins() {
  return getDb().prepare('SELECT COUNT(*) AS total FROM admins').get().total;
}

export async function findAdminByUsername(username) {
  return toAdmin(getDb().prepare('SELECT * FROM admins WHERE username = ?').get(username));
}

export async function findAdminById(id) {
  return toAdmin(getDb().prepare('SELECT * FROM admins WHERE id = ?').get(id));
}

export async function createAdmin(data) {
  getDb()
    .prepare('INSERT INTO admins (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(data.id, data.username, data.passwordHash, data.role, data.createdAt);
  return findAdminById(data.id);
}

export async function createSession(data) {
  getDb()
    .prepare('INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(data.tokenHash, data.adminId, data.expiresAt, data.createdAt);
}

export async function findSession(tokenHash) {
  const row = getDb().prepare(`
    SELECT s.token_hash, s.admin_id, s.expires_at, a.username, a.role
    FROM admin_sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ?
  `).get(tokenHash);
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    adminId: row.admin_id,
    expiresAt: row.expires_at,
    admin: { id: row.admin_id, username: row.username, role: row.role },
  };
}

export async function deleteSession(tokenHash) {
  return getDb().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash).changes > 0;
}

export async function deleteExpiredSessions(now) {
  return getDb().prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now).changes;
}
