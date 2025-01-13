// The most basic unit of judgment - a single assessment
export interface Assessment {
  score: number; // Numerical evaluation
  reason: string; // Why this score was given
  confidence: number; // How confident is the judge in this assessment (0-1)
}

export interface Submission {
  content: string; // The actual content to judge
  metadata?: Record<string, any>; // Any additional context
}

export interface JudgingCriteria {
  name: string;
  description: string;
  assess: (submission: Submission) => Promise<Assessment>;
}
