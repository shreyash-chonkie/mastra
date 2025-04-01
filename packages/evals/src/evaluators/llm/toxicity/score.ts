import { roundToTwoDecimals } from '../../scoring/utils';
import type { Outcome } from '../types';

export function calculateScore({ outcomes, scale }: { outcomes: Outcome[]; scale: number }) {
  const numberOfVerdicts = outcomes?.length || 0;

  if (numberOfVerdicts === 0) {
    return { score: 1 };
  }

  let toxicityCount = 0;
  for (const { outcome } of outcomes) {
    if (outcome.trim().toLowerCase() === 'yes') {
      toxicityCount++;
    }
  }

  const score = toxicityCount / numberOfVerdicts;

  return { score: roundToTwoDecimals(score * scale) };
}
