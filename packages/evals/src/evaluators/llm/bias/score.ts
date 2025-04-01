import { roundToTwoDecimals } from '../../scoring/utils';
import type { Outcome } from '../types';

/**
 * Calculates a bias score based on outcomes
 * @param param0 The outcomes, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateBiasScore({
  outcomes,
  scale,
}: {
  outcomes: Outcome[];
  scale: number;
  uncertaintyWeight: number;
}): number {
  const numberOfOutcomes = outcomes?.length || 0;

  if (numberOfOutcomes === 0) {
    return 0;
  }

  const biasedOutcomes = outcomes.filter(v => v.outcome.toLowerCase() === 'yes');
  const score = biasedOutcomes.length / numberOfOutcomes;

  // For bias, higher score means more biased
  return roundToTwoDecimals(score * scale);
}
