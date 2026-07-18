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

    summary += `\nCRITICAL INSTRUCTION: You MUST use this context to adjust your match score and explicitly reference it in your recommendation. For example, if the current job strongly resembles the jobs the user DISLIKES, lower the match score and EXPLICITLY state in your recommendation: "Based on your history of rejecting X roles..." (or similar). If it resembles jobs they LIKE, slightly increase the score and mention it. If you do not explicitly mention their past preferences in the recommendation string, you have failed the prompt.`;

    return summary;
  } catch (error) {
    console.error('Error summarizing feedback:', error);
    return "Failed to retrieve past feedback context. Provide a standard, objective match score.";
  }
};

export const analyzeAndScoreMatch = (
  resumeText: string,
  jobDescription: string,
  pastFeedbackSummary: string,
  priority: string = 'balanced'
): string => {
  let priorityInstruction = 'Evaluate all factors equally.';
  if (priority === 'prioritize_salary') {
    priorityInstruction = 'While evaluating skills, give extra weight to whether the job appears to be a high-compensation role or senior position matching the user\'s level.';
  } else if (priority === 'prioritize_skills') {
    priorityInstruction = 'Give maximum weight strictly to the technical and hard skill overlap between the extracted skills and requirements.';
  }

  return `
You are an expert technical recruiter AI. Your task is to analyze a candidate's resume and a job description, then calculate a Match Score.

INSTRUCTIONS:
1. Extract skills and experience from the Candidate's Resume.
2. Extract required and nice-to-have skills from the Job Description.
3. Compare the candidate's skills against the job requirements.
4. ${priorityInstruction}
5. Consider the following context about the user's past behavior:
${pastFeedbackSummary}
6. You MUST respond ONLY with a valid JSON object. Do NOT include markdown formatting, do NOT include \`\`\`json or \`\`\` tags. The output must be parseable by JSON.parse().

The JSON object MUST exactly match this structure:
{
  "extractedSkills": {
    "skills": string[], // Array of extracted skills
    "experienceLevel": string, // "Entry-level", "Mid-level", "Senior", etc.
    "yearsOfExperience": number // Estimated total years of experience
  },
  "extractedRequirements": {
    "requiredSkills": string[], // Array of absolutely required skills
    "niceToHaveSkills": string[], // Array of bonus or nice-to-have skills
    "requiredExperienceLevel": string // e.g., "Entry-level", "Mid-level", "Senior"
  },
  "matchPercentage": number, // A number between 0 and 100 representing the overall match
  "matchingSkills": string[], // Array of 3-5 key skills the candidate possesses that match the job requirements
  "missingSkills": string[], // Array of 1-3 key required skills that the candidate lacks
  "recommendation": string // A single sentence recommendation on whether they should apply, taking into account their past feedback behavior.
}

Candidate Resume:
"""
${resumeText}
"""

Job Description:
"""
${jobDescription}
"""
`;
};
