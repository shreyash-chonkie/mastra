import { Agent } from '@mastra/core';

export const AgentMastra = new Agent({
  name: 'Agent Mastra',
  instructions: 'You know everything about the world',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20241022',
    toolChoice: 'auto',
  },
});
