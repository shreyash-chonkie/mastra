import { LLMClassifierFromTemplate, AnswerCorrectness, Factuality } from 'autoevals';

// Basic correctness - baseline for all techniques
export const correctMathAnswer = LLMClassifierFromTemplate({
  name: 'Basic Correctness',
  promptTemplate: `Given a math problem and its solution, evaluate if the technique led to the correct answer.
    
Problem: {{input}}
Solution: {{output}}
Expected: {{expected}}

1. Find the final numerical answer
2. Compare it to the expected result
3. Ignore presentation, focus only on numerical correctness

Answer Y/N with brief explanation.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Overall technique effectiveness
export const overallTechniqueEffectiveness = LLMClassifierFromTemplate({
  name: 'Overall Technique Effectiveness',
  promptTemplate: `Evaluate how well the prompting technique worked for this math problem.

Problem: {{input}}
Solution: {{output}}
Expected: {{expected}}

Consider:
1. Did the technique help reach the correct answer?
2. Was the technique appropriate for this problem type?
3. Did the technique add clarity to the solution process?

Answer Y/N with brief analysis of technique effectiveness.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Answer Relevancy - evaluates how relevant the response is to the input
export const answerRelevancy = LLMClassifierFromTemplate({
  name: 'Answer Relevancy',
  promptTemplate: `Evaluate how relevant the solution is to the given math problem.

Problem: {{input}}
Solution: {{output}}

Consider:
1. Does the solution directly address the question asked?
2. Are all calculations and steps relevant to solving this specific problem?
3. Is there any extraneous or off-topic information?

Answer Y/N with brief explanation of relevancy assessment.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Contextual Precision - evaluates if the important information is prioritized
export const contextualPrecision = LLMClassifierFromTemplate({
  name: 'Contextual Precision',
  promptTemplate: `Evaluate if the solution properly prioritizes the key information from the problem.

Problem: {{input}}
Solution: {{output}}

Consider:
1. Are the important numbers and operations from the problem used appropriately?
2. Is the solution focused on the core mathematical concepts needed?
3. Is the key information from the problem properly emphasized in the solution?

Answer Y/N with brief analysis of information prioritization.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Hallucination Detection - checks for factual correctness
export const hallucinationDetection = LLMClassifierFromTemplate({
  name: 'Hallucination Detection',
  promptTemplate: `Evaluate if the solution contains any hallucinated or incorrect information.

Problem: {{input}}
Solution: {{output}}
Expected: {{expected}}

Consider:
1. Are all numbers used actually present in or derived from the original problem?
2. Are any mathematical rules or formulas incorrectly stated or applied?
3. Are there any unsupported assumptions or made-up information?

Answer Y/N with brief explanation of any detected hallucinations or confirmation of factual correctness.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});
