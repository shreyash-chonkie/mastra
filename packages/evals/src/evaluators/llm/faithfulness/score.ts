import { roundToTwoDecimals } from '../../scoring/utils';
import type { Outcome } from '../types';

/**
 * Calculates a faithfulness score based on outcomes
 * @param param0 The outcome, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateFaithfulnessScore({ outcomes, scale }: { outcomes: Outcome[]; scale: number }): {
  score: number;
} {
  const totalClaims = outcomes.length;
  const supportedClaims = outcomes.filter(v => v.outcome === 'yes').length;

  if (totalClaims === 0) {
    return { score: 0 };
  }

  const score = (supportedClaims / totalClaims) * scale;
  return { score: roundToTwoDecimals(score) };
}
