import readability from 'readability';

export class ReadabilityScorer {
  async score(text: string): Promise<ScoringResult> {
    const scores = readability.getScores(text);

    // Normalize scores to 0-1 range
    const fleschScore = Math.max(0, Math.min(scores.fleschKincaid / 100, 1));
    const automatedScore = Math.max(0, Math.min(scores.automated / 100, 1));
    const colemanScore = Math.max(0, Math.min(scores.coleman / 100, 1));

    const compositeScore = (fleschScore + automatedScore + colemanScore) / 3;

    return {
      score: compositeScore,
      details: `Readability score: ${(compositeScore * 100).toFixed(1)}%`,
      confidence: 0.8,
      metrics: {
        fleschKincaid: scores.fleschKincaid,
        automated: scores.automated,
        coleman: scores.coleman,
      },
    };
  }
}
