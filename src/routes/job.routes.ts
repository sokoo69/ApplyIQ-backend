import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { createJob, getAllJobs, getJobById, updateJob, deleteJob } from '../controllers/job.controller';

const router = Router();

router.get('/', getAllJobs);
router.get('/:id', getJobById);

// Admin only routes
router.use(requireAuth);
router.use(requireRole(['admin']));

router.post('/', createJob);
router.patch('/:id', updateJob);
router.delete('/:id', deleteJob);

export default router;
