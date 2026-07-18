import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, getMe, demoLogin, googleLogin, googleCallback } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

/**
 * Security Decision: Rate limit the login/register endpoints to prevent 
 * brute-force and credential stuffing attacks. Limits to 10 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.post('/demo-login', demoLogin);

// Custom Google OAuth Routes
router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);

export default router;
