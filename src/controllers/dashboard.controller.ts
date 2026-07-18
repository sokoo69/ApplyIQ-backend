import { Request, Response } from 'express';
import Application from '../models/Application.model';

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    // We can run parallel aggregations or a faceted single aggregation. 
    // Facets are cleanest.
    
    // We need:
    // 1. Total applications
    // 2. Status counts (Saved, Applied, Interview, Offer, Rejected)
    // 3. Upcoming deadlines (deadline > now)
    // 4. Activity (last 5 status changes from statusHistory)
    // 5. Tracked per week (last 8 weeks)

    const now = new Date();
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const result = await Application.aggregate([
      { $match: { user: userId } },
      {
        $facet: {
          totalAndStatusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              }
            }
          ],
          upcomingDeadlines: [
            { $match: { deadline: { $gt: now } } },
            { $count: 'count' }
          ],
          weeklyTracking: [
            { $match: { createdAt: { $gte: eightWeeksAgo } } },
            {
              $group: {
                _id: { $week: "$createdAt" },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          recentActivity: [
            // Unwind status history to get individual events
            { $unwind: "$statusHistory" },
            { $sort: { "statusHistory.changedAt": -1 } },
            { $limit: 5 },
            {
              $project: {
                title: 1, // Fallback manual title
                job: 1, // Reference to populated later if needed, but in aggregation it's just ID
                status: "$statusHistory.status",
                date: "$statusHistory.changedAt"
              }
            }
          ]
        }
      }
    ]);

    const data = result[0];

    // Restructure for the frontend
    let totalApplications = 0;
    const statusCounts: Record<string, number> = {
      Saved: 0,
      Applied: 0,
      Interview: 0,
      Offer: 0,
      Rejected: 0
    };

    data.totalAndStatusCounts.forEach((item: any) => {
      if (statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
      totalApplications += item.count;
    });

    const upcomingDeadlinesCount = data.upcomingDeadlines.length > 0 ? data.upcomingDeadlines[0].count : 0;

    // For recent activity, populate the job titles if present
    const recentActivity = data.recentActivity.map((act: any) => ({
      _id: act._id,
      title: act.title || 'Untitled Role',
      jobId: act.job, // Will need client side fallback if we don't look up, but let's do a quick lookup
      status: act.status,
      date: act.date
    }));

    // Perform a manual lookup for job titles to keep aggregation fast
    const jobIdsToLookup = recentActivity.filter((act: any) => act.jobId).map((act: any) => act.jobId);
    if (jobIdsToLookup.length > 0) {
      const mongoose = require('mongoose');
      const Job = mongoose.model('Job');
      const jobs = await Job.find({ _id: { $in: jobIdsToLookup } }, 'title company');
      const jobMap = new Map(jobs.map((j: any) => [j._id.toString(), j]));
      
      recentActivity.forEach((act: any) => {
        if (act.jobId && jobMap.has(act.jobId.toString())) {
          const job: any = jobMap.get(act.jobId.toString());
          act.title = `${job.title} at ${job.company}`;
        }
      });
    }

    res.json({
      totalApplications,
      statusCounts,
      upcomingDeadlinesCount,
      weeklyTracking: data.weeklyTracking,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Server error fetching dashboard summary' });
  }
};
