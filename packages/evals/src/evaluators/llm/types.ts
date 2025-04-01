import type { Agent } from '@mastra/core/agent';

export type TestCase = {
  input: string;
  output: string;
  context?: string[];
  expectedResult: {
    score: number;
    reason?: string;
  };
};

export type Outcome = {
  outcome: string;
  reason: string;
  claim: string;
};

export type LLMEvaluatorReasonPromptArgs = {
  agent: Agent;
  input: string;
  output: string;
  score: number;
  scale: number;
  context?: string[];
  outcomes: Outcome[];
};

export type LLMEvaluatorReasonPrompt = (args: LLMEvaluatorReasonPromptArgs) => Promise<string> | string;

export type LLMEvaluatorPromptArgs = {
  agent: Agent;
  input: string;
  output: string;
  context?: string[];
  [key: string]: any;
};

export type LLMEvaluatorEvalPrompt = (args: LLMEvaluatorPromptArgs) => Promise<string> | string;

export type LLMEvaluatorScorer = ({
  outcomes,
  scale,
  uncertaintyWeight,
  context,
}: {
  uncertaintyWeight: number;
  scale: number;
  outcomes: Outcome[];
  context?: string[];
}) => number;
