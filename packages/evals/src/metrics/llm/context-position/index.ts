import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { ContextPosition } from '../../../evaluators/llm/context-position/index';
import type { MetricResultWithReason } from '../types';

export interface ContextPositionMetricOptions {
  scale?: number;
  context: string[];
}

export class ContextPositionMetric extends Metric {
  private evaluator: ContextPosition;

  constructor(model: LanguageModel, { scale = 1, context }: ContextPositionMetricOptions) {
    super();
    this.evaluator = new ContextPosition({ model, scale, context });
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    return this.evaluator.score({ input, output });
  }
}
