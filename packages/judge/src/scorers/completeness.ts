export class CompletenessScorer {
  async score(response: string, prompt: string): Promise<ScoringResult> {
    // Extract question markers from prompt
    const questionWords = prompt.match(/\b(who|what|when|where|why|how|which|whose)\b/gi) || [];
    const questionMarks = (prompt.match(/\?/g) || []).length;

    // Check if response addresses question patterns
    const addressedQuestions = questionWords.filter(qWord => new RegExp(`\\b${qWord}\\b`, 'i').test(response));

    // Check response structure
    const hasConclusion = /in conclusion|to summarize|therefore|thus|finally|overall|in summary/i.test(response);
    const hasIntroduction = (response?.split('.')?.[0]?.length || 0) > 20;

    // Calculate completeness score
    const questionScore = questionMarks ? addressedQuestions.length / questionWords.length : 1;
    const structureScore = (Number(hasConclusion) + Number(hasIntroduction)) / 2;

    const score = questionScore * 0.7 + structureScore * 0.3;

    return {
      score,
      details: `Completeness score: ${(score * 100).toFixed(1)}%`,
      confidence: 0.75,
      metrics: {
        questionCoverage: questionScore,
        structureCompleteness: structureScore,
        hasConclusion,
        hasIntroduction,
      },
    };
  }
}
