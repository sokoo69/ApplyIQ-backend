import { Request, Response } from 'express';
import AuditLog from '../models/AuditLog.model';
import Job from '../models/Job.model';
import Application from '../models/Application.model';
import mongoose from 'mongoose';

/** Helper: write an audit log entry */
async function writeAudit(
  adminUserId: string,
  action: 'create_job' | 'update_job' | 'delete_job',
  targetJobId: string,
  changesSummary: string
) {
  await AuditLog.create({ adminUser: adminUserId, action, targetJobId, changesSummary, timestamp: new Date() });
}

// ─── Audit Logs ────────────────────────────────────────────────────────────────
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('adminUser', 'name email');

    const total = await AuditLog.countDocuments();
    res.json({ logs, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Server error fetching audit logs' });
  }
};

// ─── Platform Stats ────────────────────────────────────────────────────────────
export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const AIUsageLog = (await import('../models/AIUsageLog.model')).default;
    const today = new Date().toISOString().split('T')[0];

    const [totalJobs, totalUsers, totalApplications, aiUsageLogs] = await Promise.all([
      Job.countDocuments(),
      mongoose.model('User').countDocuments(),
      Application.countDocuments(),
      AIUsageLog.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: '$count' } } },
      ]),
    ]);

    const aiUsageToday = aiUsageLogs[0]?.total || 0;

    // Jobs by category for chart
    const jobsByCategory = await Job.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { category: { $ifNull: ['$_id', 'Uncategorized'] }, count: 1, _id: 0 } },
    ]);

    // Applications by job category
    const appsByCategory = await Application.aggregate([
      { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'jobData' } },
      { $unwind: { path: '$jobData', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$jobData.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { category: { $ifNull: ['$_id', 'Manual Entry'] }, count: 1, _id: 0 } },
    ]);

    res.json({ totalJobs, totalUsers, totalApplications, aiUsageToday, jobsByCategory, appsByCategory });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Users Overview ────────────────────────────────────────────────────────────
export const getAdminUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const UserModel = mongoose.model('User');
    const [users, total] = await Promise.all([
      UserModel.find({}, { name: 1, email: 1, role: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      UserModel.countDocuments(),
    ]);

    res.json({ users, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Job CRUD (Admin) ─────────────────────────────────────────────────────────
export const adminCreateJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id as string;
    const job = await Job.create({ ...req.body, postedBy: adminId });
    await writeAudit(adminId, 'create_job', job._id.toString(), `Created job: "${job.title}" at ${job.company}`);
    res.status(201).json(job);
  } catch (error: any) {
    console.error('Error creating job:', error);
    res.status(400).json({ message: error.message || 'Failed to create job' });
  }
};

export const adminUpdateJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id as string;
    const { id } = req.params;
    const before = await Job.findById(id);
    if (!before) { res.status(404).json({ message: 'Job not found' }); return; }

    const updated = await Job.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });
    const changedFields = Object.keys(req.body).join(', ');
    await writeAudit(adminId, 'update_job', String(id), `Updated fields [${changedFields}] on "${before.title}"`);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating job:', error);
    res.status(400).json({ message: error.message || 'Failed to update job' });
  }
};

export const adminDeleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id as string;
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) { res.status(404).json({ message: 'Job not found' }); return; }

    await Job.findByIdAndDelete(id);
    await writeAudit(adminId, 'delete_job', String(id), `Deleted job: "${job.title}" at ${job.company}`);
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Applicant Management (Admin) ─────────────────────────────────────────────
export const getJobApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    const applications = await Application.find({ job: jobId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    console.error('Error fetching job applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminUpdateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const application = await Application.findById(id);
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
    
    await writeAudit(req.user?.id as string, 'update_job', String(application.job), `Updated application status to ${status}`);
    
    res.json(application);
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
