import { Request, Response } from 'express';
import { z } from 'zod';
import Job from '../models/Job.model';
import User from '../models/User.model';
import MatchFeedback from '../models/MatchFeedback.model';
import { callGemini } from '../services/gemini.service';
import { buildMatchPrompt, summarizePastFeedback } from '../services/matchScore.service';

const getMatchScoreSchema = z.object({
  jobId: z.string(),
  priority: z.enum(['balanced', 'prioritize_salary', 'prioritize_skills']).default('balanced'),
});

const recordFeedbackSchema = z.object({
  jobId: z.string(),
  signal: z.enum(['applied', 'rejected', 'not_interested', 'saved']),
  matchScoreAtTime: z.number(),
});

export const getMatchScore = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = getMatchScoreSchema.parse(req.body);
    const { jobId, priority } = validatedData;
    const userId = req.user?.id;

    // Fetch user for resume text
    const user = await User.findById(userId);
    if (!user || !user.resumeText) {
      res.status(400).json({ message: 'Resume text is required to generate a match score. Please update your profile first.' });
      return;
    }

    // Fetch Job description
    const job = await Job.findById(jobId);
    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    const pastFeedbackSummary = await summarizePastFeedback(userId);
    const prompt = buildMatchPrompt(user.resumeText, job.description, pastFeedbackSummary, priority);
    
    // Call Gemini API with Retry Logic for JSON parsing
    let maxRetries = 1;
    let parsedData = null;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const outputText = await callGemini(prompt, { maxOutputTokens: 1024 });
        
        // Sometimes Gemini still includes markdown fences even when instructed not to
        let cleanJsonStr = outputText.trim();
        if (cleanJsonStr.startsWith('```json')) {
          cleanJsonStr = cleanJsonStr.substring(7);
        }
        if (cleanJsonStr.startsWith('```')) {
          cleanJsonStr = cleanJsonStr.substring(3);
        }
        if (cleanJsonStr.endsWith('```')) {
          cleanJsonStr = cleanJsonStr.substring(0, cleanJsonStr.length - 3);
        }
        cleanJsonStr = cleanJsonStr.trim();

        parsedData = JSON.parse(cleanJsonStr);
        
        // Validate parsed shape roughly
        if (typeof parsedData.matchPercentage !== 'number' || 
            !Array.isArray(parsedData.matchingSkills) ||
            !Array.isArray(parsedData.missingSkills) ||
            typeof parsedData.recommendation !== 'string') {
          throw new Error('Parsed JSON does not match the expected schema.');
        }

        break; // Success
      } catch (err: any) {
        lastError = err;
        console.warn(`Attempt ${attempt + 1} failed to parse Gemini JSON:`, err.message);
      }
    }

    if (!parsedData) {
      res.status(502).json({ message: 'Failed to process AI match score. Please try again later.' });
      return;
    }

    res.json(parsedData);

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    console.error('Error getting match score:', error);
    res.status(500).json({ message: error.message || 'Server error getting match score' });
  }
};

export const recordFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = recordFeedbackSchema.parse(req.body);
    const { jobId, signal, matchScoreAtTime } = validatedData;
    const userId = req.user?.id;

    const feedback = new MatchFeedback({
      user: userId,
      job: jobId,
      signal,
      matchScoreAtTime,
    });

    await feedback.save();

    res.status(201).json({ message: 'Feedback recorded successfully', feedback });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    console.error('Error recording match feedback:', error);
    res.status(500).json({ message: 'Server error recording match feedback' });
  }
};
