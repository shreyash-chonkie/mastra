import { JudgingResult } from '../types';

export function mExpect(result: JudgingResult) {
  return {
    toHaveMinimumScore(threshold: number) {
      const passed = result.score >= threshold;
      return {
        passed,
        feedback: passed ? [] : [`Expected minimum score of ${threshold}, got ${result.score.toFixed(2)}`],
      };
    },

    toHaveMinimumCategoryScore(category: string, threshold: number) {
      const categoryScore = result.details.categoryScores[category] || 0;
      const passed = categoryScore >= threshold;
      return {
        passed,
        feedback: passed ? [] : [`Expected minimum ${category} score of ${threshold}, got ${categoryScore.toFixed(2)}`],
      };
    },

    toPassAllThresholds() {
      const passed = result.details.failedThresholds.length === 0;
      return {
        passed,
        feedback: passed ? [] : [`Failed thresholds: ${result.details.failedThresholds.join(', ')}`],
      };
    },

    toHaveConfidenceAbove(threshold: number) {
      const passed = result.confidence >= threshold;
      if (!passed) {
        throw new Error(`Expected minimum confidence of ${threshold}, got ${result.confidence.toFixed(2)}`);
      }
      return passed;
    },
  };
}
