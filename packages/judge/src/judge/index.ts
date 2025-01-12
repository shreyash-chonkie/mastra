import { JudgingConfig, JudgingContext, JudgingResult, ScoringResult } from '../types';

export class Judge {
  private config: JudgingConfig;

  constructor(config: JudgingConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  private validateConfig(config: JudgingConfig) {
    if (!config.scorers.length) {
      throw new Error('At least one scorer must be configured');
    }

    const totalWeight = config.scorers.reduce((sum, s) => sum + s.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new Error('Scorer weights must sum to 1');
    }
  }

  async judge(response: string, context: Partial<JudgingContext> = {}): Promise<JudgingResult> {
    const judgingContext: JudgingContext = {
      timestamp: new Date(),
      metadata: {},
      ...context,
    };

    // Collect metadata first
    const metadata = await this.collectMetadata(response, judgingContext);
    judgingContext.metadata = metadata;

    // Run all scorers
    const scoringResults = await this.runScorers(response, judgingContext);

    // Calculate category scores
    const categoryScores = this.calculateCategoryScores(scoringResults);

    // Check thresholds
    const failedThresholds = this.checkThresholds(scoringResults);

    // Calculate final score using configured aggregation strategy
    const overallScore = this.aggregateScores(scoringResults);

    // Calculate overall confidence
    const confidence = this.calculateConfidence(scoringResults);

    // Generate feedback
    const feedback = this.generateFeedback(scoringResults, failedThresholds);

    return {
      score: overallScore,
      confidence,
      details: {
        overallScore,
        categoryScores,
        individualScores: scoringResults,
        failedThresholds,
        metadata,
      },
      feedback,
    };
  }

  private async collectMetadata(response: string, context: JudgingContext): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    if (this.config.metadataCollectors) {
      for (const collector of this.config.metadataCollectors) {
        metadata[collector.name] = await collector.collect(response, context);
      }
    }

    return metadata;
  }

  private async runScorers(response: string, context: JudgingContext): Promise<Record<string, ScoringResult>> {
    const results: Record<string, ScoringResult> = {};

    for (const { scorer, weight } of this.config.scorers) {
      try {
        let result: ScoringResult;

        if (scorer.score.length === 1) {
          result = await scorer.score(response);
        } else if (context.reference) {
          result = await scorer.score(response, context.reference);
        } else if (context.prompt) {
          result = await scorer.score(response, context.prompt);
        } else {
          result = await scorer.score(response);
        }

        results[scorer.constructor.name] = {
          ...result,
          weight,
        };
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error in scorer ${scorer.constructor.name}:`, error);
          results[scorer.constructor.name] = {
            score: 0,
            confidence: 0,
            details: `Scoring failed: ${error.message}`,
            weight,
          };
        }
      }
    }

    return results;
  }

  private calculateCategoryScores(results: Record<string, ScoringResult>): Record<string, number> {
    const categoryScores: Record<string, number> = {};
    const categoryWeights: Record<string, number> = {};

    this.config.scorers.forEach(({ scorer, weight, category }) => {
      if (category) {
        const scorerName = scorer.constructor.name;
        const result = results[scorerName];

        if (!categoryScores[category]) {
          categoryScores[category] = 0;
          categoryWeights[category] = 0;
        }

        categoryScores[category] += (result?.score || 0) * weight;

        if (!categoryWeights[category]) {
          categoryWeights[category] = weight;
        } else {
          categoryWeights[category] += weight;
        }
      }
    });

    // Normalize category scores
    Object.keys(categoryScores).forEach(category => {
      if (categoryScores?.[category] && categoryWeights?.[category]) {
        categoryScores[category] /= categoryWeights[category];
      }
    });

    return categoryScores;
  }

  private checkThresholds(results: Record<string, ScoringResult>): string[] {
    const failed: string[] = [];

    this.config.scorers.forEach(({ scorer, threshold }) => {
      if (threshold !== undefined) {
        const scorerName = scorer.constructor.name;
        const result = results[scorerName];

        if ((result?.score || 0) < threshold) {
          failed.push(scorerName);
        }
      }
    });

    return failed;
  }

  private aggregateScores(results: Record<string, ScoringResult>): number {
    switch (this.config.aggregationStrategy) {
      case 'minimum':
        return Math.min(...Object.values(results).map(r => r.score));

      case 'maximum':
        return Math.max(...Object.values(results).map(r => r.score));

      case 'average':
        return Object.values(results).reduce((sum, r) => sum + r.score, 0) / Object.keys(results).length;

      case 'weighted':
      default:
        return Object.values(results).reduce((sum, r) => sum + r.score * (r.weight || 0), 0);
    }
  }

  private calculateConfidence(results: Record<string, ScoringResult>): number {
    // Use weighted average of individual confidences
    const totalWeight = Object.values(results).reduce((sum, r) => sum + (r?.weight || 0), 0);

    return Object.values(results).reduce((sum, r) => sum + r.confidence * (r?.weight || 0), 0) / totalWeight;
  }

  private generateFeedback(results: Record<string, ScoringResult>, failedThresholds: string[]): string[] {
    const feedback: string[] = [];

    // Add general score feedback
    Object.entries(results).forEach(([scorerName, result]) => {
      feedback.push(`${scorerName}: ${result.details}`);
    });

    // Add threshold failure feedback
    if (failedThresholds.length > 0) {
      feedback.push(`Failed thresholds: ${failedThresholds.join(', ')}`);
    }

    return feedback;
  }
}
