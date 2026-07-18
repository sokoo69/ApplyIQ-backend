import { Request, Response } from 'express';
import { z } from 'zod';
import ChatSession from '../models/ChatSession.model';
import User from '../models/User.model';
import Job from '../models/Job.model';
import Application from '../models/Application.model';
import { streamLLMChat } from '../services/llm.service';
import { buildSystemContext } from '../services/interviewCoach.service';

const createSessionSchema = z.object({
  applicationId: z.string().optional(),
  jobId: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
});

export const createChatSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { applicationId, jobId } = createSessionSchema.parse(req.body);
    const userId = req.user?.id;

    if (!applicationId && !jobId) {
      res.status(400).json({ message: 'Must provide either applicationId or jobId' });
      return;
    }

    const user = await User.findById(userId);
    if (!user || !user.resumeText) {
      res.status(400).json({ message: 'Resume text is required to start an interview coach session. Please update your profile first.' });
      return;
    }

    let jobDescription = '';
    let foundJobId = jobId || null;

    if (applicationId) {
      const application = await Application.findOne({ _id: applicationId, user: userId }).populate('job');
      if (!application) {
        res.status(404).json({ message: 'Application not found' });
        return;
      }
      if (application.job) {
        jobDescription = (application.job as any).description;
        foundJobId = (application.job as any)._id;
      } else if (application.fullDescription) {
        jobDescription = application.fullDescription;
      }
    } else if (jobId) {
      const job = await Job.findById(jobId);
      if (!job) {
        res.status(404).json({ message: 'Job not found' });
        return;
      }
      jobDescription = job.description;
    }

    if (!jobDescription) {
      res.status(400).json({ message: 'Could not find a job description.' });
      return;
    }

    const systemPrompt = buildSystemContext(user.resumeText, jobDescription);

    const session = new ChatSession({
      user: userId,
      job: foundJobId,
      application: applicationId || null,
      messages: [
        { role: 'user', content: systemPrompt },
        { role: 'user', content: "Hello! I'm ready to start the interview. Please greet me and ask the first question." }
      ],
    });

    await session.save();

    res.status(201).json({ sessionId: session._id });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0].message });
      return;
    }
    console.error('Error creating chat session:', error);
    res.status(500).json({ message: 'Server error creating chat session' });
  }
};

export const getChatSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const session = await ChatSession.findOne({ _id: id, user: req.user?.id });

    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    // Filter out the initial system prompts for the frontend if we want
    // But keeping it simple, we just return all and let frontend hide system prompt if needed
    // Actually the first two messages are system setup in our implementation
    res.json(session);
  } catch (error) {
    console.error('Error fetching chat session:', error);
    res.status(500).json({ message: 'Server error fetching chat session' });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = sendMessageSchema.parse(req.body);
    const userId = req.user?.id;

    const session = await ChatSession.findOne({ _id: id, user: userId });
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    // Add user message
    session.messages.push({ role: 'user', content, timestamp: new Date() });
    
    // Prepare messages for Gemini
    // Gemini roles are 'user' and 'model'
    const geminiMessages = session.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Setup SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const responseStream = await streamLLMChat(geminiMessages);

    let fullAssistantResponse = '';

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      fullAssistantResponse += chunkText;
      
      // Stream chunk to client
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }

    // Finished streaming text, now parse follow-up prompts if present
    let followUpPrompts: string[] = [];
    const promptMatch = fullAssistantResponse.match(/SUGGESTED_PROMPTS:\s*(\[.*\])/s);
    let finalCleanResponse = fullAssistantResponse;

    if (promptMatch && promptMatch[1]) {
      try {
        followUpPrompts = JSON.parse(promptMatch[1]);
        // Remove the prompt block from the clean response
        finalCleanResponse = fullAssistantResponse.replace(/SUGGESTED_PROMPTS:\s*\[.*\]/s, '').trim();
      } catch (e) {
        console.error('Failed to parse SUGGESTED_PROMPTS JSON', e);
      }
    }

    // Save assistant message
    session.messages.push({ role: 'assistant', content: finalCleanResponse, timestamp: new Date() });
    await session.save();

    // Send final structured metadata
    res.write(`data: ${JSON.stringify({ done: true, followUpPrompts, finalCleanResponse })}\n\n`);
    res.end();

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0].message });
      return;
    }
    console.error('Error in sendMessage:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Server error processing message' });
    } else {
      const errorMsg = error.message === 'AI_RATE_LIMIT' ? 'AI_RATE_LIMIT' : 'Failed to complete response';
      res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      res.end();
    }
  }
};
