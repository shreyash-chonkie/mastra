import { Eval } from 'braintrust';

import { mastra } from '../..';
import { gsm8kSampleDataSet } from '../data-set';

import {
  correctMathAnswer,
  overallTechniqueEffectiveness,
  answerRelevancy,
  contextualPrecision,
  hallucinationDetection,
} from './scorers';

Eval('Prompt-technique-test', {
  data: () => gsm8kSampleDataSet.map(({ input, expected }) => ({ input, expected })),
  metadata: {
    technique: 'role-based',
  },
  task: async (input: string) => {
    const agent = mastra.getAgent('AgentMastraGroq');
    const response = await agent.generate(input);
    return `${response.text}`;
  },
  scores: [
    correctMathAnswer,
    overallTechniqueEffectiveness,
    answerRelevancy,
    contextualPrecision,
    hallucinationDetection,
  ],
});
