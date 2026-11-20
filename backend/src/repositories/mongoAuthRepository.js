import { getCollection } from '../db/mongo.js';

function toAdmin(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    username: doc.username,
    role: doc.role,
    passwordHash: doc.password_hash,
    createdAt: doc.created_at,
  };
}

export async function countAdmins() {
  return getCollection('admins').countDocuments();
}

export async function findAdminByUsername(username) {
  const doc = await getCollection('admins').findOne({ username });
  return toAdmin(doc);
}

export async function findAdminById(id) {
  const doc = await getCollection('admins').findOne({ id });
  return toAdmin(doc);
}

export async function createAdmin(data) {
  await getCollection('admins').insertOne({
    id: data.id,
    username: data.username,
    password_hash: data.passwordHash,
    role: data.role,
    created_at: data.createdAt,
  });
  return findAdminById(data.id);
}

export async function updateAdminPassword(id, passwordHash) {
  await getCollection('admins').updateOne({ id }, { $set: { password_hash: passwordHash } });
  return findAdminById(id);
}

export async function createSession(data) {
  await getCollection('admin_sessions').insertOne({
    token_hash: data.tokenHash,
    admin_id: data.adminId,
    expires_at: data.expiresAt,
    created_at: data.createdAt,
  });
}

export async function findSession(tokenHash) {
  const [doc] = await getCollection('admin_sessions')
    .aggregate([
      { $match: { token_hash: tokenHash } },
      {
        $lookup: {
          from: 'admins',
          localField: 'admin_id',
          foreignField: 'id',
          as: '_admin',
        },
      },
      { $unwind: '$_admin' },
    ])
    .toArray();
  if (!doc) return null;
  return {
    tokenHash: doc.token_hash,
    adminId: doc.admin_id,
    expiresAt: doc.expires_at,
    admin: { id: doc.admin_id, username: doc._admin.username, role: doc._admin.role },
  };
}

export async function deleteSession(tokenHash) {
  const result = await getCollection('admin_sessions').deleteOne({ token_hash: tokenHash });
  return result.deletedCount > 0;
}

export async function deleteExpiredSessions(now) {
  const result = await getCollection('admin_sessions').deleteMany({ expires_at: { $lte: now } });
  return result.deletedCount;
}
