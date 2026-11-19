import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { login, logout } from '../services/authService.js';

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  res.json(await login(req.validatedBody));
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ admin: req.admin, expiresAt: req.session.expiresAt });
});

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  await logout(token);
  res.status(204).end();
}));

export default router;
