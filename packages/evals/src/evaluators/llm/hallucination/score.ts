import { roundToTwoDecimals } from '../../scoring/utils';
import type { Outcome } from '../types';

/**
 * Calculates a hallucination score based on outcomes
 * @param param0 The outcomes, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateScore({ outcomes, scale }: { outcomes: Outcome[]; scale: number }): number {
  const totalStatements = outcomes.length;
  const contradictedStatements = outcomes.filter(v => v.outcome === 'yes').length;

  if (totalStatements === 0) {
    return 0;
  }

  const score = (contradictedStatements / totalStatements) * scale;

  return roundToTwoDecimals(score);
}
