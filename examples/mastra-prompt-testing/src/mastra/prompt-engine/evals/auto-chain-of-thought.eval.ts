import { Eval } from 'braintrust';

import { mastra } from '../..';
import { gsm8kSampleDataSet } from '../data-set';
import { ChainOfThought } from '../techniques';

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
    technique: 'auto-chain-of-thought',
  },
  task: async (input: string) => {
    const chainOfThought = new ChainOfThought(input);
    const agent = mastra.getAgent('AgentMastraGroq');
    const response = await agent.generate(chainOfThought.toString());
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
