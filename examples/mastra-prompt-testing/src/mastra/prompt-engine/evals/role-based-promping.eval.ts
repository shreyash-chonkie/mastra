import { Eval } from 'braintrust';

import { mastra } from '../..';
import { gsm8kSampleDataSet } from '../data-set';
import { RolePrompt } from '../techniques';

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
    technique: 'role-based',
    role: 'math professor',
  },
  task: async (input: string) => {
    const rolePrompt = new RolePrompt(input, 'math professor');
    const agent = mastra.getAgent('AgentMastraGroq');
    const response = await agent.generate(rolePrompt.toString());
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
