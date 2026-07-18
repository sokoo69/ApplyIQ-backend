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

export const getSkillGaps = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { callLLM } = await import('../services/llm.service');
    const AgentTrace = (await import('../models/AgentTrace.model')).default;
    const DashboardCache = (await import('../models/DashboardCache.model')).default;

    const traceCount = await AgentTrace.countDocuments({ user: userId });

    let cache = await DashboardCache.findOne({ user: userId });
    
    let needsNewCommentary = false;
    let gaps: any[] = [];

    // Aggregate skill gaps
    const result = await AgentTrace.aggregate([
      { $match: { user: userId } },
      { $unwind: "$missingSkills" },
      { $group: { _id: "$missingSkills", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { skill: "$_id", count: 1, _id: 0 } }
    ]);

    gaps = result;

    if (gaps.length === 0) {
      res.json({
        gaps: [],
        commentary: "You haven't generated any match scores yet. Check a job match to see your skill gaps!"
      });
      return;
    }

    if (!cache || cache.lastTraceCount !== traceCount) {
      needsNewCommentary = true;
    }

    let commentary = cache?.skillGapCommentary || "";

    if (needsNewCommentary) {
      const prompt = `
You are a career coach AI. Look at this list of the user's most frequently missing skills across the jobs they have analyzed recently:
${JSON.stringify(gaps)}

Provide exactly ONE short, actionable sentence of advice on what they should focus on learning or highlighting to improve their match rate. Do not use formatting or markdown.`;
      
      try {
        const aiResponse = await callLLM(prompt, { maxOutputTokens: 100 });
        commentary = aiResponse.replace(/["\n]/g, '').trim();
        
        if (!cache) {
          cache = new DashboardCache({ user: userId, lastTraceCount: traceCount, skillGapCommentary: commentary });
        } else {
          cache.lastTraceCount = traceCount;
          cache.skillGapCommentary = commentary;
        }
        await cache.save();
      } catch (aiErr) {
        console.error("Failed to generate skill gap commentary:", aiErr);
        commentary = "Focus on the top skills listed below to improve your overall match rate.";
      }
    }

    res.json({
      gaps,
      commentary
    });

  } catch (error) {
    console.error('Error fetching skill gaps:', error);
    res.status(500).json({ message: 'Server error fetching skill gaps' });
  }
};
export const getAIUsageToday = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const AIUsageLog = (await import('../models/AIUsageLog.model')).default;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const limits: Record<string, number> = {
      'cover-letter': Number(process.env.AI_LIMIT_COVER_LETTER) || 10,
      'match-score':  Number(process.env.AI_LIMIT_MATCH_SCORE)  || 15,
      'chat':         Number(process.env.AI_LIMIT_CHAT_MESSAGES) || 30,
    };

    const logs = await AIUsageLog.find({ user: userId, date: today });
    const usage: Record<string, number> = {};
    logs.forEach((l: any) => { usage[l.endpoint] = l.count; });

    const result = Object.entries(limits).map(([endpoint, limit]) => ({
      endpoint,
      used: usage[endpoint] || 0,
      limit,
    }));

    const totalUsed  = result.reduce((sum, r) => sum + r.used, 0);
    const totalLimit = result.reduce((sum, r) => sum + r.limit, 0);

    res.json({ breakdown: result, totalUsed, totalLimit });
  } catch (error) {
    console.error('Error fetching AI usage today:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUpcomingDeadlines = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const applications = await Application.find({
      user: userId,
      deadline: { $gte: now, $lte: in7Days },
    })
      .sort({ deadline: 1 })
      .limit(10)
      .populate('job', 'title company');

    const deadlines = applications.map((app: any) => ({
      _id: app._id,
      title: app.title || app.job?.title || 'Untitled Role',
      company: app.job?.company || '',
      deadline: app.deadline,
      status: app.status,
    }));

    res.json({ deadlines });
  } catch (error) {
    console.error('Error fetching upcoming deadlines:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
