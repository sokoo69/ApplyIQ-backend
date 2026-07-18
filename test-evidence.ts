import { summarizePastFeedback } from './src/services/matchScore.service';

const mockFeedbacks = [
  { signal: 'applied', job: { title: 'Senior React Engineer', jobType: 'full-time', category: 'Engineering' } },
  { signal: 'applied', job: { title: 'Frontend Developer', jobType: 'remote', category: 'Engineering' } },
  { signal: 'rejected', job: { title: 'Backend Dev (Java)', jobType: 'contract', category: 'Engineering' } },
  { signal: 'rejected', job: { title: 'DevOps', jobType: 'full-time', category: 'DevOps' } },
];

jest.mock('./src/models/MatchFeedback.model', () => ({
  find: () => ({
    populate: () => ({
      sort: () => ({
        limit: () => Promise.resolve(mockFeedbacks)
      })
    })
  })
}));

async function runTests() {
  const summary = await summarizePastFeedback('mockUserId');
  console.log("=== Match Score Feedback Summary ===");
  console.log(summary);
}

runTests();
