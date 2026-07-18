export const buildCoverLetterPrompt = (
  resumeText: string, 
  jobDescription: string, 
  tone: string = 'Professional', 
  length: string = 'Medium'
): string => {
  
  let lengthInstruction = '3 to 4 paragraphs';
  if (length === 'Short') {
    lengthInstruction = '2 concise paragraphs';
  } else if (length === 'Long') {
    lengthInstruction = '4 to 5 detailed paragraphs';
  }

  return `
You are an expert career coach and professional copywriter writing a highly effective cover letter.
Your task is to write a cover letter based ONLY on the provided Resume and Job Description.

Tone: ${tone}
Length: ${lengthInstruction}

Instructions:
1. USE REAL EXPERIENCE: You MUST use the candidate's real experience and skills from the provided Resume.
2. TAILOR TO THE JOB: Explicitly connect the candidate's background to specific requirements mentioned in the Job Description.
3. AVOID FILLER: Do not use generic filler phrases like "I am writing to express my interest". Start strong.
4. DO NOT INVENT: Never hallucinate skills, experiences, or metrics that are not present in the Resume.
5. FORMAT: Provide the output as plain text formatted in standard cover letter paragraphs. Do not include placeholder brackets like [Your Name] or [Company Name] if the information is available or can be reasonably omitted.

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
