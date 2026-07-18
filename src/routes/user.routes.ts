import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { updateProfile, uploadResume } from '../controllers/user.controller';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

const router = Router();

// All user routes require authentication
router.use(requireAuth);

router.patch('/me', updateProfile);

router.post(
  '/me/resume-upload',
  (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  uploadResume
);

export default router;
