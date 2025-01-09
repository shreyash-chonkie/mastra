import { Eval } from 'braintrust';

import { mastra } from '../..';
import { Example } from '../core';
import { gsm8kSampleDataSet } from '../data-set';
import { FewShot } from '../techniques';

import {
  correctMathAnswer,
  zeroShotEffectiveness,
  fewShotEffectiveness,
  chainOfThoughtEffectiveness,
  treeOfThoughtEffectiveness,
  selfVerificationEffectiveness,
  overallTechniqueEffectiveness,
} from './scorers';

Eval('Prompt-technique-test', {
  data: () => gsm8kSampleDataSet.map(({ input, expected }) => ({ input, expected })),
  metadata: {
    technique: 'few-shot',
  },
  task: async (input: string) => {
    const exampleOne = new Example(
      `Tom buys 3 pizzas for $12 each. If he gives a 15% tip on the total bill, what is the final amount he pays?`,
      `Let me solve this step by step:
            1. Calculate the cost of pizzas: 3 × $12 = $36
            2. Calculate 15% tip: $36 × 0.15 = $5.40
            3. Total amount = Cost + Tip: $36 + $5.40 = $41.40
            Therefore, Tom pays $41.40`,
    );
    const exampleTwo = new Example(
      `A factory produces 150 toys per hour. If it operates for 8 hours per day, 5 days per week, how many toys does it produce in 4 weeks?`,
      `Let me solve this step by step:
            1. Toys per day = Hourly production × Hours: 150 × 8 = 1,200 toys/day
            2. Toys per week = Daily production × Days: 1,200 × 5 = 6,000 toys/week
            3. Toys in 4 weeks = Weekly production × Weeks: 6,000 × 4 = 24,000 toys
            Therefore, the factory produces 24,000 toys in 4 weeks`,
    );

    const fewShotInput = new FewShot(input, [exampleOne, exampleTwo]);
    const agent = mastra.getAgent('AgentMastraGroq');
    const response = await agent.generate(fewShotInput.toString());
    return `${response.text}`;
  },
  scores: [
    correctMathAnswer,
    zeroShotEffectiveness,
    fewShotEffectiveness,
    chainOfThoughtEffectiveness,
    treeOfThoughtEffectiveness,
    selfVerificationEffectiveness,
    overallTechniqueEffectiveness,
  ],
});
