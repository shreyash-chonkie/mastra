import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';

import type { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { SummarizationJudge } from './metricJudge';

export interface SummarizationMetricOptions {
  scale?: number;
}

export class SummarizationMetric extends Metric {
  private judge: SummarizationJudge;
  private scale: number;

  constructor(model: LanguageModel, { scale = 1 }: SummarizationMetricOptions = {}) {
    super();

    this.evaluator = new Summarization();

    this.judge = new SummarizationJudge(model);
    this.scale = scale;
  }
}
