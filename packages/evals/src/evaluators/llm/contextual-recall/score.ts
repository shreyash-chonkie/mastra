import { roundToTwoDecimals } from '../../scoring/utils';
import type { Outcome } from '../types';

/**
 * Calculates a contextual recall score based on outcomes
 * @param param0 The outcomes, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateContextualRecallScore({
  outcomes,
  scale,
}: {
  outcomes: Outcome[];
  scale: number;
  uncertaintyWeight: number;
  context?: string[];
}): { score: number } {
  const totalClaims = outcomes?.length || 0;
  if (totalClaims === 0) {
    return { score: 0 };
  }

  const justifiedClaims = outcomes.filter(v => v.outcome === 'yes');
  const score = justifiedClaims.length / totalClaims;

  return { score: roundToTwoDecimals(score * scale) };
}
