import { Request, Response } from 'express';
import { z } from 'zod';
import Application from '../models/Application.model';
import User from '../models/User.model';
import AIGeneration from '../models/AIGeneration.model';
import { callGemini } from '../services/gemini.service';
import { buildCoverLetterPrompt } from '../services/coverLetter.service';

const generateCoverLetterSchema = z.object({
  applicationId: z.string(),
  tone: z.enum(['Professional', 'Friendly', 'Confident']).default('Professional'),
  length: z.enum(['Short', 'Medium', 'Long']).default('Medium'),
});

export const generateCoverLetter = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = generateCoverLetterSchema.parse(req.body);
    const { applicationId, tone, length } = validatedData;
    const userId = req.user?.id;

    // Fetch user for resume text
    const user = await User.findById(userId);
    if (!user || !user.resumeText) {
      res.status(400).json({ message: 'Resume text is required to generate a cover letter. Please update your profile first.' });
      return;
    }

    // Fetch application to get job description
    const application = await Application.findOne({ _id: applicationId, user: userId }).populate('job');
    
    if (!application) {
      res.status(404).json({ message: 'Application not found.' });
      return;
    }

    // Extract Job description. If it's a public job, it's in populated `job` field. If manual, it's in `fullDescription`
    let jobDescription = '';
    if (application.job) {
      jobDescription = (application.job as any).description;
    } else if (application.fullDescription) {
      jobDescription = application.fullDescription;
    }

    if (!jobDescription) {
      res.status(400).json({ message: 'Could not find a job description to generate cover letter.' });
      return;
    }

    const prompt = buildCoverLetterPrompt(user.resumeText, jobDescription, tone, length);
    
    // Call Gemini API
    const outputText = await callGemini(prompt, { maxOutputTokens: 2048 });

    // Save history
    const aiGeneration = new AIGeneration({
      user: userId,
      application: applicationId,
      job: application.job ? (application.job as any)._id : undefined,
      type: 'cover_letter',
      inputPrompt: prompt,
      outputText,
      tone,
      length,
    });

    await aiGeneration.save();

    res.status(201).json(aiGeneration);

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    console.error('Error generating cover letter:', error);
    res.status(500).json({ message: error.message || 'Server error generating cover letter' });
  }
};
