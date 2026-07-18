import { Request, Response, NextFunction } from 'express';
import AIUsageLog from '../models/AIUsageLog.model';

export const aiRateLimit = (endpointName: 'cover_letter' | 'match_score' | 'chat') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      // Determine the limit from env vars with fallbacks
      let limit = 10; // default
      if (endpointName === 'cover_letter') {
        limit = parseInt(process.env.AI_LIMIT_COVER_LETTER || '10', 10);
      } else if (endpointName === 'match_score') {
        limit = parseInt(process.env.AI_LIMIT_MATCH_SCORE || '15', 10);
      } else if (endpointName === 'chat') {
        limit = parseInt(process.env.AI_LIMIT_CHAT_MESSAGES || '30', 10);
      }

      // Increase limit for demo account
      if (user.email === 'demo@applyiq.com') {
        limit = limit * 3;
      }

      // Get current date string in YYYY-MM-DD (UTC)
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];

      // Upsert the log
      const usage = await AIUsageLog.findOneAndUpdate(
        { user: user.id, endpoint: endpointName, date: dateStr },
        { $setOnInsert: { count: 0 } },
        { upsert: true, new: true }
      );

      if (usage.count >= limit) {
        // Calculate reset at midnight UTC
        const resetAt = new Date();
        resetAt.setUTCHours(24, 0, 0, 0);

        let endpointHumanName = endpointName.replace('_', ' ');
        if (endpointName === 'chat') endpointHumanName = 'interview coach messages';
        
        res.status(429).json({
          message: `Daily limit reached for ${endpointHumanName}. Resets at midnight UTC.`,
          resetAt: resetAt.toISOString(),
          limit
        });
        return;
      }

      // Increment count and proceed
      usage.count += 1;
      await usage.save();

      next();
    } catch (error) {
      console.error('Rate Limiter Error:', error);
      // Fail open: let the request through if the DB lookup fails, to avoid blocking legitimate users completely
      next();
    }
  };
};
