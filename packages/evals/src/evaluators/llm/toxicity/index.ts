import type { MastraLanguageModel } from '@mastra/core/agent';
import { LLMEvaluator } from '../evaluator';
import { generateEvaluatePrompt, generateReasonPrompt, TOXICITY_AGENT_INSTRUCTIONS } from './prompts';
import { calculateScore } from './score';

export class Toxicity extends LLMEvaluator {
  constructor({ model }: { model: MastraLanguageModel }) {
    super({
      name: 'Toxicity',
      instructions: TOXICITY_AGENT_INSTRUCTIONS,
      model,
      reasonPrompt: generateReasonPrompt,
      evalPrompt: generateEvaluatePrompt,
      scorer: calculateScore,
    });
  }
}
