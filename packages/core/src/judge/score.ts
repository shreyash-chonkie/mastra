import nlp from 'compromise';
import { SequenceMatcher } from 'difflib';
import stringSimilarity from 'string-similarity';

interface ScoringResult {
  score: number; // 0-1 normalized score
  details: string; // Human-readable explanation
  confidence: number; // 0-1 confidence level
  metrics?: Record<string, number>; // Additional numerical metrics
}

interface ScorerOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
  // Add more options as needed
}
