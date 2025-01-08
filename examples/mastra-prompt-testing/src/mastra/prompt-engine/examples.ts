import { Example } from './core';
import { buildPrompt } from './techniques';

export const benchmark = 'gsm8k';

// Representative GSM8K-style word problem
export const mathProblem = `
John spends $60 on groceries every week. Due to inflation, prices increased by 25%, 
and he also needs to buy 20% more food than before. How much will he spend on groceries per week now?
`;

// Zero-shot with clear mathematical instruction
export const zeroShot = buildPrompt('zero-shot', {
  instruction: mathProblem,
  options: {
    outputFormat: 'mathematical solution',
  },
});

// Few-shot with similar mathematical pattern
export const fewShot = buildPrompt('few-shot', {
  instruction: mathProblem,
  examples: [
    new Example(
      'A store sells shirts for $25 each. If the price increases by 20% and you buy 3 shirts, how much will you spend?',
      '1. Original price per shirt = $25\n2. Price increase = $25 × 0.20 = $5\n3. New price per shirt = $25 + $5 = $30\n4. Cost for 3 shirts = $30 × 3 = $90\nAnswer: $90',
    ),
  ],
});

// Chain of thought emphasizing logical steps
export const chainOfThought = buildPrompt('chain-of-thought', {
  instruction: mathProblem,
  steps: [
    'Calculate original weekly spending',
    'Determine price increase due to inflation',
    'Calculate new base cost',
    'Factor in 20% increase in quantity',
    'Compute final weekly cost',
  ],
  options: {
    style: 'analytical',
    outputFormat: 'sequential reasoning',
  },
});

// Auto-generate chain of thought
export const autoChainOfThought = buildPrompt('chain-of-thought', {
  instruction: mathProblem,
  options: {
    style: 'analytical',
    outputFormat: 'sequential reasoning',
  },
});

// Tree of thought exploring different solution paths
export const treeOfThought = buildPrompt('tree-of-thought', {
  instruction: mathProblem,
  branches: {
    'Sequential Approach': [
      'First handle inflation: $60 × 1.25',
      'Then handle quantity increase: result × 1.20',
      'Combine effects',
    ],
    'Combined Multiplier': [
      'Calculate total multiplier: 1.25 × 1.20',
      'Apply to original amount: $60 × total multiplier',
      'Verify result includes both effects',
    ],
    'Component Method': [
      'Break down into base + inflation increase + quantity increase',
      'Add components together',
      'Cross-check with percentage method',
    ],
  },
  options: {
    style: 'exploratory',
    outputFormat: 'multiple approaches',
  },
});

// Self-ask breaking down the problem
export const selfAsk = buildPrompt('self-ask', {
  instruction: mathProblem,
  subQuestions: [
    'What is the original weekly spending?',
    'How much extra will he pay due to inflation (25%)?',
    'What is the new base cost after inflation?',
    'How much extra food does he need (20%)?',
    'What is the final weekly cost combining both increases?',
  ],
  options: {
    style: 'investigative',
    outputFormat: 'question-based reasoning',
  },
});

// Decomposition into clear sub-problems
export const decomposition = buildPrompt('decomposition', {
  instruction: mathProblem,
  steps: [
    'Original cost: $60 per week',
    'Inflation effect: Calculate 25% increase',
    'New base cost after inflation',
    'Quantity increase: Calculate 20% more',
    'Total new weekly cost',
  ],
  options: {
    style: 'systematic',
    outputFormat: 'component breakdown',
  },
});

// Self-verification checking all steps
export const selfVerification = buildPrompt('self-verification', {
  instruction: mathProblem,
  verificationSteps: [
    'Verify inflation calculation (25% of $60)',
    'Confirm new base price after inflation',
    'Check quantity increase calculation (20%)',
    'Validate final amount includes both effects',
    'Ensure result is greater than original (should be > $60)',
  ],
  options: {
    style: 'thorough',
    outputFormat: 'verification steps',
  },
});

// Role prompting with a math teacher persona
export const rolePrompt = buildPrompt('role', {
  instruction: mathProblem,
  role: 'Mathematics Teacher',
  options: {
    style: 'pedagogical',
    outputFormat: 'educational explanation',
    constraints: [
      'Explain concepts clearly',
      'Use mathematical terminology appropriately',
      'Provide step-by-step guidance',
    ],
  },
});

// TODO: Automatic prompt engineer

// Expected answer with explanation
export const expectedAnswer = '$90';
