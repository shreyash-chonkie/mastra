import type { LanguageModel } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import type { MetricResultWithReason } from '../types';
import type {
  LLMEvaluatorEvalPrompt,
  LLMEvaluatorReasonPrompt,
  LLMEvaluatorScorer,
  LLMEvaluatorScoreResult,
  Outcome,
} from './types';

export interface EvaluatorSettings {
  scale: number;
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
    this.settings = config.settings || {
      scale: 1,
      uncertaintyWeight: 0,
    };
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
    eval_result,
    scale,
    context,
    outcomes,
  }: {
    input: string;
    output: string;
    eval_result: LLMEvaluatorScoreResult;
    scale: number;
    context?: string[];
    outcomes: Outcome[];
  }): Promise<string> {
    const prompt = await Promise.resolve(
      this.reasonPrompt?.({
        agent: this.agent,
        input,
        output,
        eval_result,
        settings: this.settings,
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
    let prompt = await Promise.resolve(
      this.evalPrompt?.({
        agent: this.agent,
        input,
        output,
        context,
      }),
    );

    if (!prompt) {
      return [];
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
    console.log(outcomes);
    const scale = this.settings.scale ?? 1;

    const eval_result = await Promise.resolve(
      this.scorer({
        outcomes,
        settings: this.settings,
        context: this.settings.context,
        agent: this.agent,
        input,
        output,
      }),
    );

    const reason = await this.reason({
      input,
      output,
      eval_result,
      scale,
      outcomes,
      context: this.settings.context,
    });

    return {
      score: eval_result.score,
      info: {
        reason,
        ...(eval_result.details ?? {}),
      },
    };
  }
}
