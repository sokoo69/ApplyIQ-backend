import { Request, Response } from 'express';
import { z } from 'zod';
import Application from '../models/Application.model';

// Zod schemas
const createApplicationSchema = z.object({
  job: z.string().optional(),
  title: z.string().optional(),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  deadline: z.string().optional(),
  imageUrl: z.string().optional(),
}).refine(data => {
  // Either `job` must be provided (public job tracking) OR `title` (manual tracking)
  return data.job || data.title;
}, "Either job ID or custom job details must be provided");

const updateApplicationStatusSchema = z.object({
  status: z.enum(['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'])
});

export const createApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createApplicationSchema.parse(req.body);
    
    // Check if tracking an existing job
    if (validatedData.job) {
      // Check for duplicate
      const existing = await Application.findOne({ user: req.user?.id, job: validatedData.job });
      if (existing) {
        res.status(409).json({ message: "You're already tracking this job" });
        return;
      }
    }

    const application = new Application({
      user: req.user?.id,
      ...validatedData,
      status: 'Saved',
      statusHistory: [{ status: 'Saved', changedAt: new Date() }]
    });

    await application.save();
    res.status(201).json(application);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0].message });
      return;
    }
    console.error('Error creating application:', error);
    res.status(500).json({ message: 'Server error creating application' });
  }
};

export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await Application.find({ user: req.user?.id })
      .populate('job')
      .sort({ createdAt: -1 });
    
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Server error fetching applications' });
  }
};

export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = updateApplicationStatusSchema.parse(req.body);

    const application = await Application.findOne({ _id: id, user: req.user?.id });

    if (!application) {
      res.status(404).json({ message: 'Application not found' });
      return;
    }

    application.status = status;
    application.statusHistory.push({ status, changedAt: new Date() });
    
    if (status === 'Applied' && !application.appliedAt) {
      application.appliedAt = new Date();
    }

    await application.save();
    res.json(application);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0].message });
      return;
    }
    console.error('Error updating application:', error);
    res.status(500).json({ message: 'Server error updating application' });
  }
};

export const deleteApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const application = await Application.findOneAndDelete({ _id: id, user: req.user?.id });

    if (!application) {
      res.status(404).json({ message: 'Application not found' });
      return;
    }

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ message: 'Server error deleting application' });
  }
};
