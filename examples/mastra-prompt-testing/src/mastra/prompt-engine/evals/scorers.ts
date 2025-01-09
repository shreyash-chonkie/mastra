import { LLMClassifierFromTemplate } from 'autoevals';

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

// Zero-shot effectiveness
export const zeroShotEffectiveness = LLMClassifierFromTemplate({
  name: 'Zero-Shot Effectiveness',
  promptTemplate: `Evaluate if the solution shows effective direct problem-solving without examples.

Solution: {{output}}

Check if the solution:
1. Directly addresses the problem without needing examples
2. Shows clear understanding of what's asked
3. Arrives at answer efficiently

Answer Y/N focusing on direct problem-solving ability.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Few-shot learning effectiveness
export const fewShotEffectiveness = LLMClassifierFromTemplate({
  name: 'Few-Shot Learning',
  promptTemplate: `Evaluate if the solution effectively uses the provided example pattern.

Solution: {{output}}

Check if the solution:
1. Follows the example's problem-solving pattern
2. Adapts the example's approach appropriately
3. Shows improved solving due to the example

Answer Y/N focusing on example utilization.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Chain-of-thought effectiveness
export const chainOfThoughtEffectiveness = LLMClassifierFromTemplate({
  name: 'Chain-of-Thought',
  promptTemplate: `Evaluate if the solution shows effective step-by-step reasoning.

Solution: {{output}}

Check if the solution:
1. Shows clear progression of thoughts
2. Links each step logically
3. Demonstrates step-by-step problem decomposition

Answer Y/N focusing on reasoning chain quality.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Tree-of-thought effectiveness
export const treeOfThoughtEffectiveness = LLMClassifierFromTemplate({
  name: 'Tree-of-Thought',
  promptTemplate: `Evaluate if the solution effectively explores multiple solution paths.

Solution: {{output}}

Check if the solution:
1. Considers different valid approaches
2. Evaluates multiple solution paths
3. Selects the most appropriate method

Answer Y/N focusing on approach exploration.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Self-ask effectiveness
export const selfAskEffectiveness = LLMClassifierFromTemplate({
  name: 'Self-Ask',
  promptTemplate: `Evaluate if the solution effectively uses self-questioning.

Solution: {{output}}

Check if the solution:
1. Breaks down problem into sub-questions
2. Answers each sub-question clearly
3. Builds to final answer through questions

Answer Y/N focusing on question-based solving.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});

// Self-verification effectiveness
export const selfVerificationEffectiveness = LLMClassifierFromTemplate({
  name: 'Self-Verification',
  promptTemplate: `Evaluate if the solution effectively verifies its work.

Solution: {{output}}

Check if the solution:
1. Includes meaningful verification steps
2. Catches potential errors
3. Confirms answer validity

Answer Y/N focusing on verification quality.`,
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

// Role prompting effectiveness
export const rolePromptEffectiveness = LLMClassifierFromTemplate({
  name: 'Role Prompting',
  promptTemplate: `Evaluate if the solution effectively maintains the assigned professional role.

Solution: {{output}}

Check if the solution:
1. Maintains consistent role perspective
2. Uses role-appropriate expertise and terminology
3. Delivers value through role-specific insights

Answer Y/N focusing on role adherence and effectiveness.`,
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
});
