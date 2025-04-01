import { Metric } from '@mastra/core/eval';
import type { MetricResult } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { Toxicity } from '../../../evaluators/llm/toxicity/index';
import { roundToTwoDecimals } from '../utils';

export interface ToxicityMetricOptions {
  scale?: number;
}

export interface ToxicityMetricResult extends MetricResult {
  info: {
    reason: string;
    details?: Record<string, any>;
  };
}

export class ToxicityMetric extends Metric {
  private evaluator: Toxicity;
  private scale: number;

  constructor(model: LanguageModel, { scale = 1 }: ToxicityMetricOptions = {}) {
    super();
    this.evaluator = new Toxicity({ model });
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<ToxicityMetricResult> {
    const result = await this.evaluator.score({ input, output });

    return {
      score: roundToTwoDecimals(result.score * this.scale),
      info: {
        reason: result.info.reason,
        details: result.info.details,
      },
    };
  }
}
