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
} from '../examples';

import {
  correctMathAnswer,
  zeroShotEffectiveness,
  fewShotEffectiveness,
  chainOfThoughtEffectiveness,
  treeOfThoughtEffectiveness,
  selfVerificationEffectiveness,
  overallTechniqueEffectiveness,
} from './scorers';

// Eval('Anthropic', {
//     data: [
//         {
//             input: mathProblem,
//             expected: expectedAnswer,
//             tags: ['math-problem'],
//             metadata: {
//                 technique: 'math-problem'
//             }
//         },
//         {
//             input: zeroShot.toString(),
//             expected: expectedAnswer,
//             tags: ['zero-shot'],
//             metadata: {
//                 technique: 'zero-shot'
//             }
//         },
//         {
//             input: fewShot.toString(),
//             expected: expectedAnswer,
//             tags: ['few-shot'],
//             metadata: {
//                 technique: 'few-shot'
//             }
//         },
//         {
//             input: autoChainOfThought.toString(),
//             expected: expectedAnswer,
//             tags: ['auto-chain-of-thought'],
//             metadata: {
//                 technique: 'auto-chain-of-thought'
//             }
//         },
//         {
//             input: chainOfThought.toString(),
//             expected: expectedAnswer,
//             tags: ['chain-of-thought'],
//             metadata: {
//                 technique: 'chain-of-thought'
//             }
//         },
//         {
//             input: selfVerification.toString(),
//             expected: expectedAnswer,
//             tags: ['self-verification'],
//             metadata: {
//                 technique: 'self-verification'
//             }
//         },
//         {
//             input: treeOfThought.toString(),
//             expected: expectedAnswer,
//             tags: ['tree-of-thought'],
//             metadata: {
//                 technique: 'tree-of-thought'
//             }
//         }
//     ],
//     task: async (input) => {
//         const agent = mastra.getAgent('AgentMastraAnthropic');
//         const response = await agent.generate(input);
//         return `${response.text}`;
//     },
//     scores: [correctMathAnswer, zeroShotEffectiveness, fewShotEffectiveness, chainOfThoughtEffectiveness, treeOfThoughtEffectiveness, selfVerificationEffectiveness, overallTechniqueEffectiveness],
//     metadata: {
//         model: 'anthropic',
//         benchmark
//     }
// });
