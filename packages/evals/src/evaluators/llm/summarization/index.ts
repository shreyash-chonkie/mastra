import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import { generateReasonPrompt, SUMMARIZATION_AGENT_INSTRUCTIONS } from './prompts';
import { score } from './score';

export class Summarization extends LLMEvaluator {
  constructor({ model }: { model: LanguageModel }) {
    super({
      name: 'Summarization',
      instructions: SUMMARIZATION_AGENT_INSTRUCTIONS,
      scorer: score,
      model: model,
      reasonPrompt: generateReasonPrompt,
    });
  }
}
