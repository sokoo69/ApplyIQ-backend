import { GoogleGenAI } from '@google/genai';
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-flash-latest',
    contents: 'Write a short 2-sentence intro about a software engineer.',
  });

  for await (const chunk of responseStream) {
    console.log('CHUNK:', JSON.stringify(chunk.text));
  }
}
run();
