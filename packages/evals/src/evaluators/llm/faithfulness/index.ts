import type { MastraLanguageModel } from '@mastra/core/agent';
import { z } from 'zod';
import { LLMEvaluator } from '../evaluator';
import {
  AGENT_INSTRUCTIONS,
  generateReasonPrompt,
  generateEvaluatePrompt,
  generateClaimExtractionPrompt,
} from './prompts';
import { calculateFaithfulnessScore } from './score';
import type { Outcome } from '../types';

export interface FaithfulnessOptions {
  model: MastraLanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
  context?: string[];
}

/**
 * Faithfulness evaluator class that extends LLMEvaluator
 * Evaluates how factually consistent the output is with the provided context
 */
export class Faithfulness extends LLMEvaluator {
  constructor(options: FaithfulnessOptions) {
    super({
      name: 'Faithfulness',
      instructions: AGENT_INSTRUCTIONS,
      model: options.model,
      reasonPrompt: generateReasonPrompt,
      evalPrompt: generateEvaluatePrompt,
      scorer: calculateFaithfulnessScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }

  // Override the evaluate method to handle the two-step process:
  // 1. Extract claims from the output
  // 2. Evaluate each claim against the context
  async evaluate({ output, context }: { input: string; output: string; context?: string[] }): Promise<Outcome[]> {
    // Step 1: Extract claims from the output
    const claimsPrompt = generateClaimExtractionPrompt({ output });
    const claimsResult = await this.agent.generate(claimsPrompt, {
      output: z.object({
        claims: z.array(z.string()),
      }),
    });

    const claims = claimsResult.object.claims;
    if (claims.length === 0) {
      return [];
    }

    // Step 2: Evaluate each claim against the context
    const contextToUse = context || this.settings.context || [];
    const evaluatePrompt = generateEvaluatePrompt({ claims, context: contextToUse });
    const result = await this.agent.generate(evaluatePrompt, {
      output: z.object({
        outcomes: z.array(
          z.object({
            claim: z.string(),
            outcome: z.string(),
            reason: z.string(),
          }),
        ),
      }),
    });

    return result.object.outcomes;
  }
}
