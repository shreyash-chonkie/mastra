import { roundToTwoDecimals } from '../../metrics/llm/utils';

export function isCloserTo(value: number, target1: number, target2: number): boolean {
  return Math.abs(value - target1) < Math.abs(value - target2);
}

export function calculateScore({
  verdicts,
  scale,
  uncertaintyWeight,
}: {
  verdicts: { verdict: string; reason: string }[];
  scale: number;
  uncertaintyWeight: number;
}): number {
  const numberOfVerdicts = verdicts?.length || 0;
  if (numberOfVerdicts === 0) {
    return 1;
  }

  let relevancyCount = 0;
  for (const { verdict } of verdicts) {
    if (verdict.trim().toLowerCase() === 'yes') {
      relevancyCount++;
    } else if (verdict.trim().toLowerCase() === 'unsure') {
      relevancyCount += uncertaintyWeight;
    }
  }

  const score = relevancyCount / numberOfVerdicts;
  return roundToTwoDecimals(score * scale);
}
