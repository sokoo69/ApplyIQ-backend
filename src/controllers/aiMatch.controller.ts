import { Request, Response } from 'express';
import { z } from 'zod';
import Job from '../models/Job.model';
import User from '../models/User.model';
import MatchFeedback from '../models/MatchFeedback.model';
import { callLLM } from '../services/llm.service';
import AgentTrace from '../models/AgentTrace.model';
import { analyzeAndScoreMatch, summarizePastFeedback } from '../services/matchScore.service';

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
      const outputText = await callLLM(prompt, { maxOutputTokens: maxTokens, jsonMode: true });
      
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
    throw new Error(`Failed to parse AI response: ${lastError?.message || 'Unknown error'}`);
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

    // Step 1: Execute single optimized Gemini prompt
    const pastFeedbackSummary = await summarizePastFeedback(userId);
    const analyzePrompt = analyzeAndScoreMatch(user.resumeText, job.description, pastFeedbackSummary, priority);
    
    const analysisResult = await executeGeminiStep(analyzePrompt, 4096, (data) => {
      return typeof data.matchPercentage === 'number' && 
             data.extractedSkills &&
             data.extractedRequirements;
    });

    // Synthesize Trace Steps for UI and DB
    const traceSteps = [
      {
        stepName: 'Extract Skills',
        input: { resumeLength: user.resumeText.length },
        output: analysisResult.extractedSkills
      },
      {
        stepName: 'Extract Requirements',
        input: { jobDescriptionLength: job.description.length },
        output: analysisResult.extractedRequirements
      },
      {
        stepName: 'Compare and Score',
        input: { 
          extractedSkills: analysisResult.extractedSkills, 
          extractedRequirements: analysisResult.extractedRequirements, 
          pastFeedbackSummary 
        },
        output: {
          matchPercentage: analysisResult.matchPercentage,
          matchingSkills: analysisResult.matchingSkills,
          missingSkills: analysisResult.missingSkills,
          recommendation: analysisResult.recommendation
        }
      }
    ];

    // Save Agent Trace
    const agentTrace = new AgentTrace({
      user: userId,
      job: jobId,
      steps: traceSteps,
      missingSkills: analysisResult.missingSkills
    });
    await agentTrace.save();

    res.json({
      matchPercentage: analysisResult.matchPercentage,
      matchingSkills: analysisResult.matchingSkills,
      missingSkills: analysisResult.missingSkills,
      recommendation: analysisResult.recommendation,
      agentTrace: traceSteps
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0].message });
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
      res.status(400).json({ message: error.issues[0].message });
      return;
    }
    console.error('Error recording match feedback:', error);
    res.status(500).json({ message: 'Server error recording match feedback' });
  }
};
