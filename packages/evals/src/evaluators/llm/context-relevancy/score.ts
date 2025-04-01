import { roundToTwoDecimals } from '../../scoring/utils';

/**
 * Calculates a context relevancy score based on outcomes
 * @param param0 The outcomes, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateContextRelevancyScore({
  outcomes,
  scale,
}: {
  outcomes: { outcome: string; reason: string }[];
  scale: number;
  uncertaintyWeight: number;
  context?: string[];
}): number {
  const totalOutcomes = outcomes?.length || 0;
  if (totalOutcomes === 0) {
    return 0;
  }

  const relevantOutcomes = outcomes.filter(v => v.outcome.toLowerCase() === 'yes');
  const score = relevantOutcomes.length / totalOutcomes;

  return roundToTwoDecimals(score * scale);
}
