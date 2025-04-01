import type { MetricResult } from '@mastra/core/eval';

export interface MetricResultWithReason extends MetricResult {
  info: {
    reason: string;
    details: Record<string, any>;
  };
}
