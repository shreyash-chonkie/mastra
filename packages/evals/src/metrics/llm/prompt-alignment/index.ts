import { Metric } from '@mastra/core/eval';
import type { MetricResult } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { PromptAlignment } from '../../../evaluators/llm/prompt-alignment/index';

export interface PromptAlignmentMetricOptions {
  scale?: number;
  instructions: string[];
}

type PromptAlignmentScoreDetails = {
  totalInstructions: number;
  applicableInstructions: number;
  followedInstructions: number;
  naInstructions: number;
};

export interface PromptAlignmentMetricResult extends MetricResult {
  info: {
    reason: string;
    scoreDetails: PromptAlignmentScoreDetails;
    details?: Record<string, any>;
  };
}

export class PromptAlignmentMetric extends Metric {
  private evaluator: PromptAlignment;

  constructor(model: LanguageModel, { instructions, scale = 1 }: PromptAlignmentMetricOptions) {
    super();
    this.evaluator = new PromptAlignment({ model, scale, context: instructions });
  }

  async measure(input: string, output: string): Promise<PromptAlignmentMetricResult> {
    const result = await this.evaluator.score({ input, output });

    console.log(result);

    return {
      score: result.score,
      info: {
        reason: result.info.reason,
        scoreDetails: (result.info.details as PromptAlignmentScoreDetails) || {
          totalInstructions: 0,
          applicableInstructions: 0,
          followedInstructions: 0,
          naInstructions: 0,
        },
        details: result.info.details,
      },
    };
  }
}
