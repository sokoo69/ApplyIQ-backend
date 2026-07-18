import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createApplication,
  getMyApplications,
  updateApplicationStatus,
  deleteApplication
} from '../controllers/application.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

router.post('/', createApplication);
router.get('/me', getMyApplications);
router.patch('/:id', updateApplicationStatus);
router.delete('/:id', deleteApplication);

export default router;
