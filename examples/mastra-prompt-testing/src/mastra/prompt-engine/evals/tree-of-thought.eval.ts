import { Eval } from 'braintrust';

import { mastra } from '../..';
import { Instruction } from '../core';
import { gsm8kSampleDataSet } from '../data-set';
import { TreeOfThought } from '../techniques';

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
    technique: 'tree-of-thought',
  },
  task: async (input: string) => {
    const instruction = new Instruction(input, {
      style: 'exploratory',
      outputFormat: 'branching analysis',
      constraints: ['Consider multiple valid approaches', 'Evaluate each path', 'Choose optimal solution'],
    });
    const branches = {
      'Direct Calculation': ['Parse numbers', 'Apply operations', 'Get result'],
      'Step-by-Step': ['Break down problem', 'Solve each part', 'Combine results'],
      'Visual Method': ['Draw diagram', 'Count/Calculate', 'Verify result'],
    };
    const treeOfThought = new TreeOfThought(instruction, branches);
    const agent = mastra.getAgent('AgentMastraGroq');
    const response = await agent.generate(treeOfThought.toString());
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
