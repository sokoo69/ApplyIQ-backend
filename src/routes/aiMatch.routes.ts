import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getMatchScore, recordFeedback } from '../controllers/aiMatch.controller';

const router = Router();

router.use(requireAuth);

router.post('/', getMatchScore);
router.post('/feedback', recordFeedback);

export default router;
