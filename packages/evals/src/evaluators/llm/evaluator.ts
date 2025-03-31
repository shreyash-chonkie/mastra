import type { LanguageModel } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import type { MetricResultWithReason } from '../../metrics/llm/types';
import type { LLMEvaluatorEvalPrompt, LLMEvaluatorReasonPrompt, LLMEvaluatorScorer } from './types';

export interface EvaluatorConfig {
  name: string;
  instructions: string;
  reasonPrompt?: LLMEvaluatorReasonPrompt;
  evalPrompt?: LLMEvaluatorEvalPrompt;
  scorer: LLMEvaluatorScorer;
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
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
  protected scale: number;
  protected uncertaintyWeight: number;
  protected name: string;
  protected reasonPrompt?: LLMEvaluatorReasonPrompt;
  protected evalPrompt?: LLMEvaluatorEvalPrompt;
  protected scorer: LLMEvaluatorScorer;

  constructor(config: EvaluatorConfig) {
    this.name = config.name;
    this.scale = config.scale || 1;
    this.uncertaintyWeight = config.uncertaintyWeight || 0;
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
    verdicts,
  }: {
    input: string;
    output: string;
    score: number;
    scale: number;
    verdicts: { verdict: string; reason: string }[];
  }): Promise<string> {
    const prompt = await Promise.resolve(
      this.reasonPrompt?.({
        agent: this.agent,
        input,
        output,
        score,
        scale,
        verdicts,
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

  async evaluate(input: string, actualOutput: string): Promise<{ verdict: string; reason: string }[]> {
    const prompt = await Promise.resolve(
      this.evalPrompt?.({
        agent: this.agent,
        input,
        output: actualOutput,
      }),
    );

    if (!prompt) {
      throw new Error('Evaluation prompt not generated.');
    }

    const result = await this.agent.generate(prompt, {
      output: z.object({
        verdicts: z.array(
          z.object({
            verdict: z.string(),
            reason: z.string(),
          }),
        ),
      }),
    });

    return result.object.verdicts;
  }

  async score(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.evaluate(input, output);
    const score = this.scorer({ verdicts, scale: this.scale, uncertaintyWeight: this.uncertaintyWeight });
    const reason = await this.reason({ input, output, score, scale: this.scale, verdicts });

    return {
      score,
      info: {
        reason,
      },
    };
  }
}
