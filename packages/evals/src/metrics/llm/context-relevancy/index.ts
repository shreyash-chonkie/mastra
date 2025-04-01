import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { ContextRelevancy } from '../../../evaluators/llm/context-relevancy/index';
import type { MetricResultWithReason } from '../../../evaluators/types';

export interface ContextRelevancyOptions {
  scale?: number;
  context: string[];
}

export class ContextRelevancyMetric extends Metric {
  private evaluator: ContextRelevancy;

  constructor(model: LanguageModel, { scale = 1, context }: ContextRelevancyOptions) {
    super();
    this.evaluator = new ContextRelevancy({ model, scale, context });
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    return this.evaluator.score({ input, output });
  }
}
