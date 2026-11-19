import { HttpError } from '../errors.js';

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.admin || req.admin.role !== role) {
      return next(new HttpError(403, 'Forbidden: insufficient role'));
    }
    return next();
  };
}
