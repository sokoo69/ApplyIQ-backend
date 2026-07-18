import { Request, Response } from 'express';
import { z } from 'zod';
import Job from '../models/Job.model';

const createJobSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  companyLogoUrl: z.string().url().optional().or(z.literal('')),
  location: z.string().optional(),
  category: z.string().optional(),
  salaryRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  jobType: z.enum(['full-time', 'part-time', 'remote', 'contract']).optional(),
  description: z.string().min(10),
  requirements: z.array(z.string()).default([]),
  deadline: z.string().optional(), // Date string
});

export const createJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createJobSchema.parse(req.body);
    const userId = req.user?.id;

    const job = new Job({
      ...validatedData,
      postedBy: userId,
      deadline: validatedData.deadline ? new Date(validatedData.deadline) : undefined,
    });

    await job.save();

    // Audit Logging
    try {
      const AuditLog = (await import('../models/AuditLog.model')).default;
      await AuditLog.create({
        adminUser: userId,
        action: 'create_job',
        targetJobId: job.id,
        changesSummary: `Created job: ${job.title}`
      });
    } catch (auditErr) {
      console.error('Failed to create audit log for createJob:', auditErr);
    }

    res.status(201).json(job);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0].message });
      return;
    }
    console.error('Error creating job:', error);
    res.status(500).json({ message: 'Server error creating job' });
  }
};

export const getAllJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, location, search, sort, page = '1', limit = '12' } = req.query;
    
    const query: any = {};
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions: any = {};
    if (sort === 'recent') sortOptions.createdAt = -1;
    else if (sort === 'salary_desc') sortOptions['salaryRange.max'] = -1;
    else sortOptions.createdAt = -1; // Default

    const skip = (Number(page) - 1) * Number(limit);

    const jobs = await Job.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate('postedBy', 'name');

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error getting jobs:', error);
    res.status(500).json({ message: 'Server error fetching jobs' });
  }
};

export const getJobById = async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id).populate('postedBy', 'name email');
    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }
    res.json(job);
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({ message: 'Server error fetching job' });
  }
};

export const updateJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createJobSchema.partial().parse(req.body);
    const userId = req.user?.id;
    
    // ANY admin can manage any job for simplicity (per requirements)
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }

    // Determine simple diff for Audit Log
    const changes: string[] = [];
    for (const [key, value] of Object.entries(validatedData)) {
      if (key === 'deadline') {
        const oldDeadline = job.deadline ? job.deadline.toISOString().split('T')[0] : 'None';
        const newDeadline = new Date(value as string).toISOString().split('T')[0];
        if (oldDeadline !== newDeadline) {
          changes.push(`deadline from ${oldDeadline} to ${newDeadline}`);
        }
      } else if (key === 'salaryRange') {
        const oldMin = job.salaryRange?.min || 0;
        const oldMax = job.salaryRange?.max || 0;
        const newMin = (value as any)?.min || 0;
        const newMax = (value as any)?.max || 0;
        if (oldMin !== newMin || oldMax !== newMax) {
          changes.push(`salary from ${oldMin}-${oldMax} to ${newMin}-${newMax}`);
        }
      } else {
        const oldVal = (job as any)[key];
        // simple equality for strings/numbers
        if (oldVal !== value && typeof value !== 'object') {
          // Truncate long strings for audit log
          let oldStr = String(oldVal);
          let newStr = String(value);
          if (oldStr.length > 20) oldStr = oldStr.substring(0, 20) + '...';
          if (newStr.length > 20) newStr = newStr.substring(0, 20) + '...';
          changes.push(`${key} from "${oldStr}" to "${newStr}"`);
        }
      }
    }

    Object.assign(job, validatedData);
    if (validatedData.deadline) {
      job.deadline = new Date(validatedData.deadline);
    }

    await job.save();

    // Audit Logging
    try {
      if (changes.length > 0) {
        const AuditLog = (await import('../models/AuditLog.model')).default;
        await AuditLog.create({
          adminUser: userId,
          action: 'update_job',
          targetJobId: job.id,
          changesSummary: `Updated fields: ${changes.join(', ')}`
        });
      }
    } catch (auditErr) {
      console.error('Failed to create audit log for updateJob:', auditErr);
    }

    res.json(job);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0].message });
      return;
    }
    console.error('Error updating job:', error);
    res.status(500).json({ message: 'Server error updating job' });
  }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    // ANY admin can manage any job
    const job = await Job.findByIdAndDelete(req.params.id);
    
    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }

    // Audit Logging
    try {
      const AuditLog = (await import('../models/AuditLog.model')).default;
      await AuditLog.create({
        adminUser: userId,
        action: 'delete_job',
        targetJobId: req.params.id as string,
        changesSummary: `Deleted job: ${job.title}`
      });
    } catch (auditErr) {
      console.error('Failed to create audit log for deleteJob:', auditErr);
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Server error deleting job' });
  }
};
