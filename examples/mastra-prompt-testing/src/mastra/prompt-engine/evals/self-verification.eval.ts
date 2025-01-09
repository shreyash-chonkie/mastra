import { Eval } from 'braintrust';

import { mastra } from '../..';
import { gsm8kSampleDataSet } from '../data-set';
import { SelfVerification } from '../techniques';

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
    technique: 'self-verification',
  },
  task: async (input: string) => {
    const selfVerification = new SelfVerification(input);
    const agent = mastra.getAgent('AgentMastraGroq');
    const response = await agent.generate(selfVerification.toString());
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
