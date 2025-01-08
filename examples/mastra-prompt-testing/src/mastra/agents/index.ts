import { Agent } from '@mastra/core';

export const AgentMastraAnthropic = new Agent({
  name: 'Agent Mastra Anthropic',
  instructions: 'You know everything about the world',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20241022',
    toolChoice: 'auto',
  },
});
export const AgentMastraOpenAI = new Agent({
  name: 'Agent Mastra OpenAI',
  instructions: 'You know everything about the world',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
});
export const AgentMastraGroq = new Agent({
  name: 'Agent Mastra Groq',
  instructions: 'You know everything about the world',
  model: {
    provider: 'GROQ',
    name: 'llama3-8b-8192',
    toolChoice: 'auto',
  },
});
