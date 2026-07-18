import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;

const initGemini = () => {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
};

export const callGemini = async (prompt: string, options: any = {}): Promise<string> => {
  const client = initGemini();
  
  if (!client) {
    throw new Error('Gemini API key is not configured.');
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxOutputTokens || 1024,
      }
    });

    if (!response.text) {
      throw new Error('Received empty response from Gemini');
    }

    return response.text.trim();
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    
    // Handle specific errors based on Google SDK or common node fetch errors
    if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      throw new Error('Request timed out while generating content.');
    }
    
    throw new Error('Failed to generate content using AI.');
  }
};

export const streamGeminiChat = async (messages: any[], options: any = {}) => {
  const client = initGemini();
  if (!client) throw new Error('Gemini API key is not configured.');

  try {
    const responseStream = await client.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: messages,
      config: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxOutputTokens || 2048,
      }
    });

    return responseStream;
  } catch (error: any) {
    console.error('Error in streamGeminiChat:', error);
    throw new Error('Failed to start chat stream');
  }
};
