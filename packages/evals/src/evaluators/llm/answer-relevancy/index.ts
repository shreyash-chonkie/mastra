import type { MastraLanguageModel } from '@mastra/core/agent';
import { LLMEvaluator } from '../evaluator';
import { calculateScore } from '../utils';
import { AGENT_INSTRUCTIONS, generateReasonPrompt, generateEvaluationPrompt } from './prompts';

/**
 * Creates an Answer Relevancy evaluator
 * @param options Configuration options for the evaluator
 * @returns A new LLMEvaluator instance configured for answer relevancy evaluation
 */
export function createAnswerRelevancy({
  model,
  scale = 1,
  uncertaintyWeight = 0.5,
}: {
  model: MastraLanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
}): LLMEvaluator {
  return new LLMEvaluator({
    name: 'Answer Relevancy',
    instructions: AGENT_INSTRUCTIONS,
    model,
    reasonPrompt: generateReasonPrompt,
    evalPrompt: generateEvaluationPrompt,
    scorer: calculateScore,
    scale,
    uncertaintyWeight,
  });
}
