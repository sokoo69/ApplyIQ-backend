import Groq from 'groq-sdk';

let groqClient: Groq | null = null;

const initGroq = () => {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
};

export const callLLM = async (prompt: string, options: any = {}): Promise<string> => {
  const client = initGroq();
  
  if (!client) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  let retries = 0;
  const maxRetries = 3;
  let delayMs = 6000; // Start with 6s delay

  while (true) {
    try {
      // Use Llama 3.3 70b Versatile for Match Score & Cover Letters due to complex reasoning needs
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxOutputTokens || 1024,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {})
      });

      const text = response.choices[0]?.message?.content;
      
      if (!text) {
        throw new Error('Received empty response from Groq');
      }

      return text.trim();
    } catch (error: any) {
      // Groq SDK returns error status as error.status
      if (error.status === 429 && retries < maxRetries) {
        console.warn(`Groq Rate Limit hit. Retrying in ${delayMs/1000}s... (Attempt ${retries + 1} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        retries++;
        delayMs *= 2; // Exponential backoff (6s, 12s, 24s)
        continue;
      }

      console.error('Error calling Groq API:', error);
      
      if (error.status === 429) {
        throw new Error('AI_RATE_LIMIT');
      }
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        throw new Error('Request timed out while generating content.');
      }
      
      throw new Error(`Failed to generate content using AI: ${error.message || 'Unknown error'}`);
    }
  }
};

export const streamLLMChat = async (messages: any[], options: any = {}) => {
  const client = initGroq();
  if (!client) throw new Error('GROQ_API_KEY is not configured.');

  try {
    // Translate Gemini message format back to OpenAI/Groq format
    const formattedMessages = messages.map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.parts && m.parts[0] ? m.parts[0].text : ''
    }));

    // Use Llama 3.1 8b Instant for Interview Coach chat where latency is critical
    const responseStream = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: formattedMessages as any,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxOutputTokens || 2048,
      stream: true,
    });

    // Wrap the stream to emit { text } objects, perfectly mirroring the Gemini SDK interface
    // so that aiChat.controller.ts doesn't need a single line changed.
    async function* wrapGroqStream(stream: AsyncIterable<any>) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          yield { text };
        }
      }
    }

    return wrapGroqStream(responseStream);
  } catch (error: any) {
    console.error('Error in streamLLMChat:', error);
    if (error.status === 429) {
      throw new Error('AI_RATE_LIMIT');
    }
    throw new Error('Failed to start chat stream');
  }
};
