import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { updateProfile } from '../controllers/user.controller';

const router = Router();

// All user routes require authentication
router.use(requireAuth);

router.patch('/me', updateProfile);

export default router;
