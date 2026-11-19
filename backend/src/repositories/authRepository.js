import { getDrivers } from '../db/index.js';

export const authRepository = {
  countAdmins: () => getDrivers().auth.countAdmins(),
  findAdminByUsername: (username) => getDrivers().auth.findAdminByUsername(username),
  findAdminById: (id) => getDrivers().auth.findAdminById(id),
  createAdmin: (data) => getDrivers().auth.createAdmin(data),
  createSession: (data) => getDrivers().auth.createSession(data),
  findSession: (tokenHash) => getDrivers().auth.findSession(tokenHash),
  deleteSession: (tokenHash) => getDrivers().auth.deleteSession(tokenHash),
  deleteExpiredSessions: (now) => getDrivers().auth.deleteExpiredSessions(now),
};
