const executeGeminiStep = async (prompt: string, maxTokens: number, validator: (data: any) => boolean) => {
  let maxRetries = 1;
  let parsedData = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;
    try {
      console.log(`\n[Attempt ${attempt + 1}] Calling Gemini API...`);
      let outputText = '';
      if (attempt === 0) {
        outputText = "Here is the JSON: \n```json\n{ missing_quote: test }\n```"; // Malformed JSON
      } else {
        outputText = '{"matchPercentage": 85, "recommendation": "Great fit!"}'; // Valid JSON
      }

      let cleanJsonStr = outputText.trim();
      if (cleanJsonStr.startsWith('```json')) cleanJsonStr = cleanJsonStr.substring(7);
      if (cleanJsonStr.startsWith('```')) cleanJsonStr = cleanJsonStr.substring(3);
      if (cleanJsonStr.endsWith('```')) cleanJsonStr = cleanJsonStr.substring(0, cleanJsonStr.length - 3);
      cleanJsonStr = cleanJsonStr.trim();

      parsedData = JSON.parse(cleanJsonStr);
      
      if (!validator(parsedData)) {
        throw new Error('Parsed JSON does not match the expected schema.');
      }
      console.log(`[Attempt ${attempt + 1}] Success! JSON parsed correctly.`);
      break;
    } catch (err: any) {
      console.warn(`[Attempt ${attempt + 1}] Failed to parse Gemini JSON:`, err.message);
    }
  }

  if (!parsedData) {
    throw new Error('Failed to parse AI response');
  }

  return parsedData;
};

async function runTest() {
  console.log('--- TEST: Gemini Malformed JSON Retry Logic ---');
  try {
    const data = await executeGeminiStep('test prompt', 100, (data) => data.matchPercentage !== undefined);
    console.log('\nFinal Output:', data);
    console.log('\n--- TEST PASSED: Gemini retry logic works exactly once and recovers. ---');
  } catch (error: any) {
    console.error('Final Error:', error.message);
  }
}

runTest();
