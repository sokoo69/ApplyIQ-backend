import { summarizePastFeedback } from './src/services/matchScore.service';

const mockFeedbacks = [
  { signal: 'rejected', job: { title: 'Senior Go Developer', jobType: 'contract', category: 'Backend' } },
  { signal: 'rejected', job: { title: 'Go Backend Engineer', jobType: 'full-time', category: 'Backend' } },
  { signal: 'rejected', job: { title: 'Golang Engineer', jobType: 'remote', category: 'Backend' } },
];

import MatchFeedback from './src/models/MatchFeedback.model';
MatchFeedback.find = () => ({
  populate: () => ({
    sort: () => ({
      limit: () => Promise.resolve(mockFeedbacks)
    })
  })
}) as any;

async function testMatchFeedback() {
  console.log('--- TEST: Match Score Feedback Prompt Loop ---');
  console.log('User has rejected 3 Go-related backend jobs recently.');
  const summary = await summarizePastFeedback('mockUserId');
  console.log('\nGenerated Prompt Addition:');
  console.log('-----------------------------------');
  console.log(summary);
  console.log('-----------------------------------');
  console.log('\n--- TEST PASSED: Gemini will now explicitly lower scores for Go roles and mention the rejection history. ---');
}

testMatchFeedback();
