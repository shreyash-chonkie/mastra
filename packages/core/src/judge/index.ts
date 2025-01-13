import { JudgingCriteria, Assessment, Submission } from './types';

export abstract class Judge {
  protected criteria: JudgingCriteria[];

  constructor({ criteria }: { criteria: JudgingCriteria[] }) {
    this.criteria = criteria;
  }

  // Core judging function - applies all criteria
  async judge(submission: Submission): Promise<Assessment[]> {
    const assessments = await Promise.all(this.criteria.map(criterion => criterion.assess(submission)));
    return assessments;
  }

  // Aggregate multiple assessments into a final verdict
  abstract aggregate(assessments: Assessment[]): Assessment;
}
