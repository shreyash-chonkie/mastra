import { Example } from './core';
import { buildPrompt } from './techniques';

const pricingInstruction =
  'Calculate the final price for a $80 shirt with 30% off sale, $10 coupon (applied after sale discount), and 9% sales tax on the final discounted price.';

// Zero-shot example
const zeroShot = buildPrompt('zero-shot', {
  instruction: pricingInstruction,
  options: {
    format: 'numerical calculation',
    constraints: ['Show all steps', 'Round to nearest cent'],
  },
});

// Few-shot example
const fewShot = buildPrompt('few-shot', {
  instruction: pricingInstruction,
  options: {
    style: 'mathematical',
    format: 'step-by-step',
  },
  examples: [
    new Example(
      'Calculate: $100 shirt, 20% off, $5 coupon, 8% tax',
      '1. $100 - 20% = $80\n2. $80 - $5 = $75\n3. $75 + 8% = $81',
    ),
  ],
});

// Chain of thought example
const chainOfThought = buildPrompt('chain-of-thought', {
  instruction: pricingInstruction,
  steps: ['Calculate 30% discount from $80', 'Subtract $10 coupon', 'Add 9% tax'],
  options: {
    style: 'analytical',
    format: 'sequential steps',
  },
});

// Tree of thought example
const treeOfThought = buildPrompt('tree-of-thought', {
  instruction: pricingInstruction,
  branches: {
    'Percentage First': [
      'Calculate 30% off $80',
      'Apply $10 coupon to discounted price',
      'Calculate tax on final amount',
    ],
    'Alternative Approach': [
      'Convert 30% to decimal (0.7 for remaining price)',
      'Multiply $80 by 0.7',
      'Subtract $10 coupon',
      'Add 9% tax',
    ],
  },
  options: {
    style: 'exploratory',
    format: 'branching analysis',
  },
});

// Self-verification example
const selfVerification = buildPrompt('self-verification', {
  instruction: pricingInstruction,
  verificationSteps: [
    'Verify correct sale discount calculation (30% of $80)',
    'Confirm coupon applied after percentage discount',
    'Check tax calculation on final discounted price',
    'Validate that final price is logical (less than original + tax)',
  ],
  options: {
    style: 'thorough',
    format: 'verification checklist',
  },
});

// Display helper
function displayPrompt(name: string, prompt: any) {
  console.log(`\n=== ${name} ===`);
  console.log(prompt.toString());
  console.log('\n');
}

// Display all examples
[
  ['normal', pricingInstruction],
  ['Zero-Shot', zeroShot],
  ['Few-Shot', fewShot],
  ['Chain of Thought', chainOfThought],
  ['Tree of Thought', treeOfThought],
  ['Self-Verification', selfVerification],
].forEach(([name, prompt]) => displayPrompt(name as string, prompt));

export { zeroShot, fewShot, chainOfThought, treeOfThought, selfVerification };
