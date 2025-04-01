import { Metric } from '@mastra/core/eval';
import type { MetricResult } from '@mastra/core/eval';
import { KeywordCoverage } from '../../../evaluators/code/keyword-coverage';

interface KeywordCoverageResult extends MetricResult {
  info: {
    totalKeywords: number;
    matchedKeywords: number;
  };
}

interface KeywordCoverageOptions {
  language?: string;
  removeDigits?: boolean;
  returnChangedCase?: boolean;
  removeDuplicates?: boolean;
}

export class KeywordCoverageMetric extends Metric {
  private evaluator: KeywordCoverage;

  constructor(options: KeywordCoverageOptions = {}) {
    super();
    this.evaluator = new KeywordCoverage(options);
  }

  async measure(input: string, output: string): Promise<KeywordCoverageResult> {
    const result = await this.evaluator.score({ input, output });

    return {
      score: result.score,
      info: {
        totalKeywords: result.info?.totalKeywords ?? 0,
        matchedKeywords: result.info?.matchedKeywords ?? 0,
      },
    };
  }
}
