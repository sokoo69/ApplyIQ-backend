import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { getMatchScore, recordFeedback } from '../controllers/aiMatch.controller';
import { aiRateLimit } from '../middlewares/aiRateLimit.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireRole('job_seeker'));

router.post('/', aiRateLimit('match_score'), getMatchScore);
router.post('/feedback', recordFeedback);

export default router;
