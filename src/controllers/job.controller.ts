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

    res.status(201).json(job);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
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
    
    // ANY admin can manage any job for simplicity (per requirements)
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }

    Object.assign(job, validatedData);
    if (validatedData.deadline) {
      job.deadline = new Date(validatedData.deadline);
    }

    await job.save();
    res.json(job);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    console.error('Error updating job:', error);
    res.status(500).json({ message: 'Server error updating job' });
  }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    // ANY admin can manage any job
    const job = await Job.findByIdAndDelete(req.params.id);
    
    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Server error deleting job' });
  }
};
