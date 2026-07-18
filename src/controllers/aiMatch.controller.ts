import { Request, Response } from 'express';
import { z } from 'zod';
import Job from '../models/Job.model';
import User from '../models/User.model';
import MatchFeedback from '../models/MatchFeedback.model';
import { callGemini } from '../services/gemini.service';
import AgentTrace from '../models/AgentTrace.model';
import { extractSkillsFromResume, extractRequirementsFromJob, compareAndScore, summarizePastFeedback } from '../services/matchScore.service';

const getMatchScoreSchema = z.object({
  jobId: z.string(),
  priority: z.enum(['balanced', 'prioritize_salary', 'prioritize_skills']).default('balanced'),
});

const recordFeedbackSchema = z.object({
  jobId: z.string(),
  signal: z.enum(['applied', 'rejected', 'not_interested', 'saved']),
  matchScoreAtTime: z.number(),
});

const executeGeminiStep = async (prompt: string, maxTokens: number, validator: (data: any) => boolean) => {
  let maxRetries = 1;
  let parsedData = null;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const outputText = await callGemini(prompt, { maxOutputTokens: maxTokens });
      
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
      
      if (!validator(parsedData)) {
        throw new Error('Parsed JSON does not match the expected schema.');
      }

      break;
    } catch (err: any) {
      lastError = err;
      console.warn(`Attempt ${attempt + 1} failed to parse Gemini JSON:`, err.message);
    }
  }

  if (!parsedData) {
    throw new Error('Failed to parse AI response');
  }

  return parsedData;
};

export const getMatchScore = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = getMatchScoreSchema.parse(req.body);
    const { jobId, priority } = validatedData;
    const userId = req.user?.id;

    const user = await User.findById(userId);
    if (!user || !user.resumeText) {
      res.status(400).json({ message: 'Resume text is required to generate a match score. Please update your profile first.' });
      return;
    }

    const job = await Job.findById(jobId);
    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    const traceSteps: any[] = [];
    
    // Step 1: Extract Skills
    const extractSkillsPrompt = extractSkillsFromResume(user.resumeText);
    const extractedSkills = await executeGeminiStep(extractSkillsPrompt, 1024, (data) => {
      return Array.isArray(data.skills) && typeof data.experienceLevel === 'string' && typeof data.yearsOfExperience === 'number';
    });
    traceSteps.push({
      stepName: 'Extract Skills',
      input: { resumeLength: user.resumeText.length },
      output: extractedSkills
    });

    // Step 2: Extract Requirements
    const extractRequirementsPrompt = extractRequirementsFromJob(job.description);
    const extractedRequirements = await executeGeminiStep(extractRequirementsPrompt, 1024, (data) => {
      return Array.isArray(data.requiredSkills) && Array.isArray(data.niceToHaveSkills) && typeof data.requiredExperienceLevel === 'string';
    });
    traceSteps.push({
      stepName: 'Extract Requirements',
      input: { jobDescriptionLength: job.description.length },
      output: extractedRequirements
    });

    // Step 3: Compare and Score
    const pastFeedbackSummary = await summarizePastFeedback(userId);
    const comparePrompt = compareAndScore(extractedSkills, extractedRequirements, pastFeedbackSummary, priority);
    const finalScore = await executeGeminiStep(comparePrompt, 1024, (data) => {
      return typeof data.matchPercentage === 'number' && 
             Array.isArray(data.matchingSkills) &&
             Array.isArray(data.missingSkills) &&
             typeof data.recommendation === 'string';
    });
    traceSteps.push({
      stepName: 'Compare and Score',
      input: { extractedSkills, extractedRequirements, pastFeedbackSummary },
      output: finalScore
    });

    // Save Agent Trace
    const agentTrace = new AgentTrace({
      user: userId,
      job: jobId,
      steps: traceSteps,
      missingSkills: finalScore.missingSkills
    });
    await agentTrace.save();

    res.json({
      ...finalScore,
      agentTrace: traceSteps
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    console.error('Error getting match score:', error);
    res.status(502).json({ message: error.message || 'Failed to process AI match score. Please try again later.' });
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
