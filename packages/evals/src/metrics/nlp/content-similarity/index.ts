import { Metric } from '@mastra/core/eval';
import type { MetricResult } from '@mastra/core/eval';
import { ContentSimilarity } from '../../../evaluators/code/content-similarity';

interface ContentSimilarityResult extends MetricResult {
  info: {
    similarity: number;
  };
}

interface ContentSimilarityOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export class ContentSimilarityMetric extends Metric {
  private evaluator: ContentSimilarity;

  constructor(options: ContentSimilarityOptions = {}) {
    super();
    this.evaluator = new ContentSimilarity(options);
  }

  async measure(input: string, output: string): Promise<ContentSimilarityResult> {
    const result = await this.evaluator.score({ input, output });

    return {
      score: result.score,
      info: {
        similarity: result.score,
      },
    };
  }
}
