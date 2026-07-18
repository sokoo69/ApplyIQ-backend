import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createChatSession, getChatSession, sendMessage } from '../controllers/aiChat.controller';

const router = Router();

router.use(requireAuth);

router.post('/sessions', createChatSession);
router.get('/sessions/:id', getChatSession);
router.post('/sessions/:id/messages', sendMessage);

export default router;
