import type { MastraLanguageModel } from '@mastra/core/agent';
import { LLMEvaluator } from '../evaluator';
import { ANSWER_RELEVANCY_INSTRUCTIONS, generateReasonPrompt, generateEvaluationPrompt } from './prompts';
import { calculateAnswerRelevancyScore } from './score';

export interface AnswerRelevancyOptions {
  model: MastraLanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
}

/**
 * Creates an answer relevancy evaluator
 * @param options Options for the evaluator
 * @returns A new LLMEvaluator instance
 */
export function createAnswerRelevancyEvaluator(options: AnswerRelevancyOptions): LLMEvaluator {
  return new LLMEvaluator({
    name: 'Answer Relevancy',
    instructions: ANSWER_RELEVANCY_INSTRUCTIONS,
    model: options.model,
    reasonPrompt: generateReasonPrompt,
    evalPrompt: generateEvaluationPrompt,
    scorer: calculateAnswerRelevancyScore,
    settings: {
      scale: options.scale ?? 1,
      uncertaintyWeight: options.uncertaintyWeight ?? 0.5,
    },
  });
}
