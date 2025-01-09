import { Eval } from 'braintrust';

import { mastra } from '../..';
import {
  zeroShot,
  fewShot,
  chainOfThought,
  selfVerification,
  treeOfThought,
  expectedAnswer,
  benchmark,
  mathProblem,
  autoChainOfThought,
  rolePrompt,
} from '../examples';

import {
  correctMathAnswer,
  zeroShotEffectiveness,
  fewShotEffectiveness,
  chainOfThoughtEffectiveness,
  treeOfThoughtEffectiveness,
  selfVerificationEffectiveness,
  rolePromptEffectiveness,
  overallTechniqueEffectiveness,
} from './scorers';

Eval('Groq', {
  data: [
    {
      input: mathProblem,
      expected: expectedAnswer,
      tags: ['math-problem'],
      metadata: {
        technique: 'math-problem',
      },
    },
    {
      input: zeroShot.toString(),
      expected: expectedAnswer,
      tags: ['zero-shot'],
      metadata: {
        technique: 'zero-shot',
      },
    },
    {
      input: fewShot.toString(),
      expected: expectedAnswer,
      tags: ['few-shot'],
      metadata: {
        technique: 'few-shot',
      },
    },
    {
      input: chainOfThought.toString(),
      expected: expectedAnswer,
      tags: ['chain-of-thought'],
      metadata: {
        technique: 'chain-of-thought',
      },
    },
    {
      input: autoChainOfThought.toString(),
      expected: expectedAnswer,
      tags: ['auto-chain-of-thought'],
      metadata: {
        technique: 'auto-chain-of-thought',
      },
    },
    {
      input: selfVerification.toString(),
      expected: expectedAnswer,
      tags: ['self-verification'],
      metadata: {
        technique: 'self-verification',
      },
    },
    {
      input: treeOfThought.toString(),
      expected: expectedAnswer,
      tags: ['tree-of-thought'],
      metadata: {
        technique: 'tree-of-thought',
      },
    },
    {
      input: rolePrompt.toString(),
      expected: expectedAnswer,
      tags: ['role-prompt'],
      metadata: {
        technique: 'role-prompt',
      },
    },
  ],
  task: async input => {
    const agent = mastra.getAgent('AgentMastraGroq');
    const response = await agent.generate(input);
    return `${response.text}`;
  },
  scores: [
    correctMathAnswer,
    zeroShotEffectiveness,
    fewShotEffectiveness,
    chainOfThoughtEffectiveness,
    treeOfThoughtEffectiveness,
    selfVerificationEffectiveness,
    rolePromptEffectiveness,
    overallTechniqueEffectiveness,
  ],
  metadata: {
    model: 'groq',
    benchmark,
  },
});
