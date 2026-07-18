import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { generateCoverLetter } from '../controllers/aiContent.controller';
import { aiRateLimit } from '../middlewares/aiRateLimit.middleware';

const router = Router();

// All AI routes require authentication
router.use(requireAuth);
router.use(requireRole('job_seeker'));

router.post('/cover-letter', aiRateLimit('cover_letter'), generateCoverLetter);

export default router;
