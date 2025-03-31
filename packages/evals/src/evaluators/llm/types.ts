import type { Agent } from '@mastra/core/agent';

export type TestCase = {
  input: string;
  output: string;
  expectedResult: {
    score: number;
    reason?: string;
  };
};

export type LLMEvaluatorReasonPromptArgs = {
  agent: Agent;
  input: string;
  output: string;
  score: number;
  scale: number;
  verdicts: { verdict: string; reason: string }[];
};

export type LLMEvaluatorReasonPrompt = (args: LLMEvaluatorReasonPromptArgs) => Promise<string> | string;

export type LLMEvaluatorPromptArgs = {
  agent: Agent;
  input: string;
  output: string;
};

export type LLMEvaluatorEvalPrompt = (args: LLMEvaluatorPromptArgs) => Promise<string> | string;

export type LLMEvaluatorScorer = ({
  verdicts,
  scale,
  uncertaintyWeight,
}: {
  uncertaintyWeight: number;
  scale: number;
  verdicts: { verdict: string; reason: string }[];
}) => number;
