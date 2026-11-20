import { query } from '../db/postgres.js';

function toInt(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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
  const { rows } = await query('SELECT COUNT(*) AS total FROM admins');
  return toInt(rows[0]?.total);
}

export async function findAdminByUsername(username) {
  const { rows } = await query('SELECT * FROM admins WHERE username = $1', [username]);
  return toAdmin(rows[0]);
}

export async function findAdminById(id) {
  const { rows } = await query('SELECT * FROM admins WHERE id = $1', [id]);
  return toAdmin(rows[0]);
}

export async function createAdmin(data) {
  await query(
    'INSERT INTO admins (id, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)',
    [data.id, data.username, data.passwordHash, data.role, data.createdAt],
  );
  return findAdminById(data.id);
}

export async function updateAdminPassword(id, passwordHash) {
  await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  return findAdminById(id);
}

export async function createSession(data) {
  await query(
    'INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
    [data.tokenHash, data.adminId, data.expiresAt, data.createdAt],
  );
}

export async function findSession(tokenHash) {
  const { rows } = await query(
    `SELECT s.token_hash, s.admin_id, s.expires_at, a.username, a.role
     FROM admin_sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    adminId: row.admin_id,
    expiresAt: row.expires_at,
    admin: { id: row.admin_id, username: row.username, role: row.role },
  };
}

export async function deleteSession(tokenHash) {
  const { rowCount } = await query('DELETE FROM admin_sessions WHERE token_hash = $1', [tokenHash]);
  return rowCount > 0;
}

export async function deleteExpiredSessions(now) {
  const { rowCount } = await query('DELETE FROM admin_sessions WHERE expires_at <= $1', [now]);
  return rowCount;
}
