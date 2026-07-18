import MatchFeedback from '../models/MatchFeedback.model';
import mongoose from 'mongoose';

export const summarizePastFeedback = async (userId: string): Promise<string> => {
  try {
    const feedbacks = await MatchFeedback.find({ user: userId })
      .populate('job', 'title category jobType location salaryRange')
      .sort({ createdAt: -1 })
      .limit(20);

    if (feedbacks.length === 0) {
      return "The user is new and has not provided any feedback on match scores yet. Provide a standard, objective match score.";
    }

    const applied = feedbacks.filter(f => f.signal === 'applied' || f.signal === 'saved');
    const rejected = feedbacks.filter(f => f.signal === 'rejected' || f.signal === 'not_interested');

    let summary = `User Feedback Context:\n`;
    summary += `- The user has recently shown positive interest (applied/saved) in ${applied.length} jobs.\n`;
    summary += `- The user has recently rejected or ignored ${rejected.length} jobs.\n`;

    if (applied.length > 0) {
      summary += `\nJobs the user LIKES tend to have these characteristics based on recent history:\n`;
      applied.slice(0, 5).forEach((f: any) => {
        if (f.job) {
          summary += `  - Title: ${f.job.title}, Type: ${f.job.jobType}, Category: ${f.job.category}\n`;
        }
      });
    }

    if (rejected.length > 0) {
      summary += `\nJobs the user DISLIKES tend to have these characteristics based on recent history:\n`;
      rejected.slice(0, 5).forEach((f: any) => {
        if (f.job) {
          summary += `  - Title: ${f.job.title}, Type: ${f.job.jobType}, Category: ${f.job.category}\n`;
        }
      });
    }

    summary += `\nINSTRUCTION: Use this context to adjust your match score slightly. For example, if the current job strongly resembles the jobs the user DISLIKES, lower the match score and mention this in your recommendation. If it resembles jobs they LIKE, slightly increase the score.`;

    return summary;
  } catch (error) {
    console.error('Error summarizing feedback:', error);
    return "Failed to retrieve past feedback context. Provide a standard, objective match score.";
  }
};

export const buildMatchPrompt = (
  resumeText: string,
  jobDescription: string,
  pastFeedbackSummary: string,
  priority: string = 'balanced'
): string => {
  
  let priorityInstruction = 'Evaluate all factors equally.';
  if (priority === 'prioritize_salary') {
    priorityInstruction = 'While evaluating skills, give extra weight to whether the job appears to be a high-compensation role or senior position matching the user\'s level.';
  } else if (priority === 'prioritize_skills') {
    priorityInstruction = 'Give maximum weight strictly to the technical and hard skill overlap between the resume and job description.';
  }

  return `
You are an expert technical recruiter AI. Your task is to evaluate a candidate's Resume against a Job Description and calculate a Match Score.

INSTRUCTIONS:
1. Analyze the Resume and the Job Description thoroughly.
2. ${priorityInstruction}
3. Consider the following context about the user's past behavior:
${pastFeedbackSummary}
4. You MUST respond ONLY with a valid JSON object. Do NOT include markdown formatting, do NOT include \`\`\`json or \`\`\` tags. The output must be parseable by JSON.parse().

The JSON object MUST exactly match this structure:
{
  "matchPercentage": number, // A number between 0 and 100 representing the overall match
  "matchingSkills": string[], // Array of 3-5 key skills the candidate possesses that match the job
  "missingSkills": string[], // Array of 1-3 key skills required by the job that the candidate lacks
  "recommendation": string // A single sentence recommendation on whether they should apply, taking into account their past feedback behavior.
}

Resume Text:
"""
${resumeText}
"""

Job Description:
"""
${jobDescription}
"""
`;
};
