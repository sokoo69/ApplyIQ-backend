import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { generateCoverLetter } from '../controllers/aiContent.controller';

const router = Router();

// All AI routes require authentication
router.use(requireAuth);

router.post('/cover-letter', generateCoverLetter);

export default router;
