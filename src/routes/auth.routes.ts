import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getMe, demoLogin } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { auth } from '../config/better-auth';
import { toNodeHandler } from "better-auth/node";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// We can still expose the custom demo login
router.post('/demo-login', demoLogin);
// And getMe if needed by the frontend (or frontend can use better-auth client)
router.get('/me', requireAuth, getMe);


export default router;
