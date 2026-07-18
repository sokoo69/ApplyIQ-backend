import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import {
  getAuditLogs,
  getAdminStats,
  getAdminUsers,
  adminCreateJob,
  adminUpdateJob,
  adminDeleteJob,
  getJobApplications,
  adminUpdateApplicationStatus,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/audit-log', getAuditLogs);
router.get('/stats', getAdminStats);
router.get('/users', getAdminUsers);
router.post('/jobs', adminCreateJob);
router.put('/jobs/:id', adminUpdateJob);
router.delete('/jobs/:id', adminDeleteJob);

router.get('/jobs/:jobId/applications', getJobApplications);
router.patch('/applications/:id/status', adminUpdateApplicationStatus);

export default router;
