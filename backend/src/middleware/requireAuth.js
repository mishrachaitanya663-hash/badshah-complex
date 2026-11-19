import { HttpError } from '../errors.js';
import { resolveSession } from '../services/authService.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'Authentication required');

    const session = await resolveSession(token);
    if (!session) throw new HttpError(401, 'Session invalid or expired');

    req.admin = session.admin;
    req.session = session;
    return next();
  } catch (error) {
    return next(error);
  }
}
