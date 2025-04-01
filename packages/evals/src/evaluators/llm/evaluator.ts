import type { LanguageModel } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import type { MetricResultWithReason } from '../../metrics/llm/types';
import type { LLMEvaluatorEvalPrompt, LLMEvaluatorReasonPrompt, LLMEvaluatorScorer, Outcome } from './types';

export interface EvaluatorSettings {
  scale?: number;
  uncertaintyWeight?: number;
  context?: string[];
  [key: string]: any; // Allow for additional settings
}

export interface EvaluatorConfig {
  name: string;
  instructions: string;
  reasonPrompt?: LLMEvaluatorReasonPrompt;
  evalPrompt?: LLMEvaluatorEvalPrompt;
  scorer: LLMEvaluatorScorer;
  model: LanguageModel;
  settings?: EvaluatorSettings;
}

export interface EvaluationResult {
  score: number;
  reason: string;
  details?: Record<string, any>;
}

/**
 * Base Evaluator class that combines the functionality of metrics and judges.
 * This class provides a unified interface for evaluating model outputs.
 */
export class LLMEvaluator {
  protected agent: Agent;
  protected settings: EvaluatorSettings;
  protected name: string;
  protected reasonPrompt?: LLMEvaluatorReasonPrompt;
  protected evalPrompt?: LLMEvaluatorEvalPrompt;
  protected scorer: LLMEvaluatorScorer;

  constructor(config: EvaluatorConfig) {
    this.name = config.name;
    this.settings = config.settings || {};
    this.agent = new Agent({
      name: `Mastra Evaluator: ${config.name}`,
      instructions: config.instructions,
      model: config.model,
    });
    this.reasonPrompt = config.reasonPrompt;
    this.evalPrompt = config.evalPrompt;
    this.scorer = config.scorer;
  }

  async reason({
    input,
    output,
    score,
    scale,
    context,
    outcomes,
  }: {
    input: string;
    output: string;
    score: number;
    scale: number;
    context?: string[];
    outcomes: Outcome[];
  }): Promise<string> {
    const prompt = await Promise.resolve(
      this.reasonPrompt?.({
        agent: this.agent,
        input,
        output,
        score,
        scale,
        outcomes,
        context,
      }),
    );

    if (!prompt) {
      throw new Error('Reason prompt not generated.');
    }

    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });

    return result.object.reason;
  }

  async evaluate({
    input,
    output,
    context,
  }: {
    input: string;
    output: string;
    context?: string[];
  }): Promise<Outcome[]> {
    const prompt = await Promise.resolve(
      this.evalPrompt?.({
        agent: this.agent,
        input,
        output,
        context,
      }),
    );

    if (!prompt) {
      throw new Error('Evaluation prompt not generated.');
    }

    const result = await this.agent.generate(prompt, {
      output: z.object({
        outcomes: z.array(
          z.object({
            outcome: z.string(),
            reason: z.string(),
            claim: z.string(),
          }),
        ),
      }),
    });

    return result.object.outcomes;
  }

  async score({ input, output }: { input: string; output: string }): Promise<MetricResultWithReason> {
    const outcomes = await this.evaluate({ input, output, context: this.settings.context });
    const scale = this.settings.scale ?? 1;
    const uncertaintyWeight = this.settings.uncertaintyWeight ?? 0;

    const score = this.scorer({
      outcomes,
      scale,
      uncertaintyWeight,
      context: this.settings.context,
    });

    const reason = await this.reason({
      input,
      output,
      score,
      scale,
      outcomes,
      context: this.settings.context,
    });

    return {
      score,
      info: {
        reason,
      },
    };
  }
}
