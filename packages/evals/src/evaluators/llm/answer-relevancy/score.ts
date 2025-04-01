import { roundToTwoDecimals } from '../../scoring/utils';
import type { Outcome } from '../types';

export function calculateAnswerRelevancyScore({
  outcomes,
  scale,
  uncertaintyWeight,
}: {
  outcomes: Outcome[];
  scale: number;
  uncertaintyWeight: number;
}): number {
  const numberOfOutcomes = outcomes?.length || 0;
  if (numberOfOutcomes === 0) {
    return 1;
  }

  let relevancyCount = 0;
  for (const { outcome } of outcomes) {
    if (outcome.trim().toLowerCase() === 'yes') {
      relevancyCount++;
    } else if (outcome.trim().toLowerCase() === 'unsure') {
      relevancyCount += uncertaintyWeight;
    }
  }

  const score = relevancyCount / numberOfOutcomes;
  return roundToTwoDecimals(score * scale);
}
