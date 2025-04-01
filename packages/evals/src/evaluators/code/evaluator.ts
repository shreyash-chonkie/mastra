import type { MetricResult } from '@mastra/core';

export class CodeEvaluator {
  private scorer: ({ input, output }: { input: string; output: string }) => Promise<MetricResult>;
  constructor(scorer: ({ input, output }: { input: string; output: string }) => Promise<MetricResult>) {
    this.scorer = scorer;
  }
  async score({ input, output }: { input: string; output: string }): Promise<MetricResult> {
    return await this.scorer({ input, output });
  }
}
