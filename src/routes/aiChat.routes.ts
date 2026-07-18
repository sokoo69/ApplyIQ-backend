import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { createChatSession, getChatSession, sendMessage } from '../controllers/aiChat.controller';
import { aiRateLimit } from '../middlewares/aiRateLimit.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireRole('job_seeker'));

router.post('/sessions', createChatSession);
router.get('/sessions/:id', getChatSession);
router.post('/sessions/:id/messages', aiRateLimit('chat'), sendMessage);

export default router;
