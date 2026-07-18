import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { getDashboardSummary, getSkillGaps, getAIUsageToday, getUpcomingDeadlines } from '../controllers/dashboard.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('job_seeker'));

router.get('/summary', getDashboardSummary);
router.get('/skill-gaps', getSkillGaps);
router.get('/ai-usage', getAIUsageToday);
router.get('/upcoming-deadlines', getUpcomingDeadlines);

export default router;
