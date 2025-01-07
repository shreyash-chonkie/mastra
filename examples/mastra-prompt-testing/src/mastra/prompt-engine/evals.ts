import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';

import { zeroShot, fewShot, chainOfThought, selfVerification, treeOfThought } from './examples';

import { mastra } from '..';

Eval('Zero Shot', {
  data: [
    {
      input: 'zero-shot',
    },
  ],
  task: async () => {
    const agent = mastra.getAgent('AgentMastra');
    const prompt = zeroShot.toString();
    const response = await agent.generate(prompt);
    return `${response.text}`;
  },
  scores: [Factuality],
});

Eval('Few Shot', {
  data: [
    {
      input: 'few-shot',
    },
  ],
  task: async () => {
    const agent = mastra.getAgent('AgentMastra');
    const prompt = fewShot.toString();
    const response = await agent.generate(prompt);
    return `${response.text}`;
  },
  scores: [Factuality],
});

Eval('Chain of Thought', {
  data: [
    {
      input: 'chain-of-thought',
    },
  ],
  task: async () => {
    const agent = mastra.getAgent('AgentMastra');
    const prompt = chainOfThought.toString();
    const response = await agent.generate(prompt);
    return `${response.text}`;
  },
  scores: [Factuality],
});

Eval('Self Verification', {
  data: [
    {
      input: 'self-verification',
    },
  ],
  task: async () => {
    const agent = mastra.getAgent('AgentMastra');
    const prompt = selfVerification.toString();
    const response = await agent.generate(prompt);
    return `${response.text}`;
  },
  scores: [Factuality],
});

Eval('Tree of Thought', {
  data: [
    {
      input: 'tree-of-thought',
    },
  ],
  task: async () => {
    const agent = mastra.getAgent('AgentMastra');
    const prompt = treeOfThought.toString();
    const response = await agent.generate(prompt);
    return `${response.text}`;
  },
  scores: [Factuality],
});
