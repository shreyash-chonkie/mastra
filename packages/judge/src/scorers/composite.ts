import { ContentSimilarityScorer } from './content-similarity';
import { DifferenceScorer } from './difference';
import { StructuralScorer } from './structural';

export class CompositeScorer {
  private scorers: Array<{
    scorer: ContentSimilarityScorer | StructuralScorer | DifferenceScorer;
    weight: number;
  }>;

  constructor(
    scorers: Array<{
      scorer: ContentSimilarityScorer | StructuralScorer | DifferenceScorer;
      weight: number;
    }>,
  ) {
    const totalWeight = scorers.reduce((sum, { weight }) => sum + weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new Error('Weights must sum to 1');
    }
    this.scorers = scorers;
  }

  async score(text1: string, text2: string): Promise<ScoringResult> {
    const scores = await Promise.all(
      this.scorers.map(async ({ scorer, weight }) => {
        const result = await scorer.score(text1, text2);
        return {
          ...result,
          weightedScore: result.score * weight,
        };
      }),
    );

    const totalScore = scores.reduce((sum, s) => sum + s.weightedScore, 0);
    const avgConfidence = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;

    return {
      score: totalScore,
      details: scores.map(s => s.details).join('\n'),
      confidence: avgConfidence,
      metrics: scores.reduce((acc, s) => ({ ...acc, ...s.metrics }), {}),
    };
  }
}
