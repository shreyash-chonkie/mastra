import { ScoringResult } from '../types';

export class StyleConsistencyScorer {
  async score(response: string): Promise<ScoringResult> {
    // Analyze writing style patterns
    const sentences = response.split(/[.!?]+/).filter(s => s.trim());
    const wordLengths = sentences.map(s => s.split(/\s+/).length);

    // Calculate style metrics
    const avgLength = wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length;
    const lengthVariance = wordLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / wordLengths.length;

    // Analyze sentence beginnings
    const uniqueStarters = new Set(sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase()));
    const starterVariety = uniqueStarters.size / sentences.length;

    // Calculate style consistency score
    const lengthConsistency = Math.max(0, 1 - lengthVariance / avgLength);
    const score = lengthConsistency * 0.6 + starterVariety * 0.4;

    return {
      score,
      details: `Style consistency: ${(score * 100).toFixed(1)}%`,
      confidence: 0.7,
      metrics: {
        sentenceLengthVariance: lengthVariance,
        avgSentenceLength: avgLength,
        starterVariety,
        lengthConsistency,
      },
    };
  }
}
