import nlp from 'compromise';

import { ScoringResult } from '../types';

export class CompletenessScorer {
  async score(original: string, simplified: string): Promise<ScoringResult> {
    const originalDoc = nlp(original);
    const simplifiedDoc = nlp(simplified);

    // Extract and log elements
    const originalElements = this.extractElements(originalDoc);
    const simplifiedElements = this.extractElements(simplifiedDoc);
    // Maybe we need a more sophisticated matching approach
    const coverage = this.calculateCoverage(originalElements, simplifiedElements);

    return {
      score: coverage,
      details: `Completeness score: ${(coverage * 100).toFixed(1)}%`,
      confidence: 0.8,
      metrics: {
        originalElements,
        simplifiedElements,
        missingElements: originalElements.filter(e => !simplifiedElements.includes(e)),
        elementCounts: {
          original: originalElements.length,
          simplified: simplifiedElements.length,
        },
      },
    };
  }

  private extractElements(doc: any) {
    // Get more specific elements
    const nouns = doc.nouns().out('array');
    const verbs = doc.verbs().out('infinity'); // get base form of verbs
    const topics = doc.topics().out('array');
    const terms = doc.terms().out('array');

    return [...new Set([...nouns, ...verbs, ...topics, ...terms])];
  }

  private calculateCoverage(original: string[], simplified: string[]): number {
    // More flexible matching - check for substrings and word stems
    const covered = original.filter(element =>
      simplified.some(s => {
        const elem = element.toLowerCase();
        const simp = s.toLowerCase();
        return simp.includes(elem) || elem.includes(simp);
      }),
    );
    return covered.length / original.length;
  }
}
