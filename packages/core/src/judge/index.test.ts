import { Judge } from './index.js';
import { JudgingCriteria, Assessment, Submission } from './types.js';

const lengthCriterion: JudgingCriteria = {
  name: 'Length',
  description: 'Judges the submission based on its length',
  assess: async (submission: Submission): Promise<Assessment> => {
    const length = submission.content.length;

    if (length === 0) {
      return {
        score: 0,
        reason: 'Submission is empty',
        confidence: 1,
      };
    }

    // Example scoring logic
    const score = Math.min(length / 100, 1) * 10; // Max score at 100 chars
    return {
      score,
      reason: `Submission length is ${length} characters`,
      confidence: 1,
    };
  },
};

class NaiveJudge extends Judge {
  aggregate(assessments: Assessment[]): Assessment {
    // Simple averaging of scores
    const totalScore = assessments.reduce((sum, a) => sum + a.score, 0);
    const avgScore = totalScore / assessments.length;

    // Combine reasons
    const reasons = assessments.map(a => a.reason).join('\n');

    // Take minimum confidence
    const minConfidence = Math.min(...assessments.map(a => a.confidence));

    return {
      score: avgScore,
      reason: reasons,
      confidence: minConfidence,
    };
  }
}

describe('NaiveJudge', () => {
  it('should judge a submission based on length', async () => {
    const judge = new NaiveJudge({ criteria: [lengthCriterion] });

    // Create a submission
    const submission: Submission = {
      content: 'This is a test submission',
      metadata: {
        timestamp: new Date(),
        author: 'test',
      },
    };

    // Get individual assessments
    const assessments = await judge.judge(submission);

    // Get final verdict
    const verdict = judge.aggregate(assessments);

    console.log(verdict);

    return {
      individualAssessments: assessments,
      finalVerdict: verdict,
    };
  });
});
