import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const app: Application = express();

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

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

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/ai/match', aiMatchRoutes);
app.use('/api/v1/ai/chat', aiChatRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/jobs', jobRoutes);

export default app;
