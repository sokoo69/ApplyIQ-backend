import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { auth } from './config/better-auth';
import { toNodeHandler } from 'better-auth/node';

dotenv.config();

const app: Application = express();

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'https://apply-iq-frontend.vercel.app', // 'http://localhost:3000',
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(cookieParser());

// Mount Better Auth BEFORE express.json() so it can read the raw request body stream
app.all(/^\/api\/v1\/auth\/(.*)/, (req, res, next) => {
  // Skip our custom routes so they fall through to authRoutes
  const subPath = req.path.replace('/api/v1/auth', '');
  if (subPath.startsWith('/demo-login') || subPath.startsWith('/me')) {
    return next();
  }
  return toNodeHandler(auth)(req, res);
});

app.use(express.json());

// Base health-check route
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Import routes
import authRoutes from './routes/auth.routes';
import applicationRoutes from './routes/application.routes';
import aiRoutes from './routes/aiContent.routes';
import aiMatchRoutes from './routes/aiMatch.routes';
import aiChatRoutes from './routes/aiChat.routes';
import userRoutes from './routes/user.routes';
import jobRoutes from './routes/job.routes';
import dashboardRoutes from './routes/dashboard.routes';
import adminRoutes from './routes/admin.routes';

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/ai/match', aiMatchRoutes);
app.use('/api/v1/ai/chat', aiChatRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/admin', adminRoutes);

export default app;
