import type { MetricResult } from '@mastra/core/eval';
import { SequenceMatcher } from 'difflib';
import { CodeEvaluator } from '../evaluator';

async function score({ input, output }: { input: string; output: string }): Promise<MetricResult> {
  const matcher = new SequenceMatcher(null, input, output);
  const ratio = matcher.ratio();

  // Get detailed operations
  const ops = matcher.getOpcodes();
  const changes = ops.filter(([op]) => op !== 'equal').length;

  // Calculate confidence based on text length difference
  const maxLength = Math.max(input.length, output.length);
  const lengthDiff = maxLength > 0 ? Math.abs(input.length - output.length) / maxLength : 0;
  const confidence = 1 - lengthDiff;

  return {
    score: ratio,
    info: {
      confidence,
      ratio,
      changes,
      lengthDiff,
    },
  };
}

export class TextualDifference extends CodeEvaluator {
  constructor() {
    super(score);
  }
}
