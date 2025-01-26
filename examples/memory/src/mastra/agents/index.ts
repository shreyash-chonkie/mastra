import { Agent, ModelConfig } from '@mastra/core';
import { createOllama } from 'ollama-ai-provider';

const ollama = createOllama({
  // optional settings, e.g.
  // baseURL: 'https://api.ollama.com',
});

const modelConfig: ModelConfig = {
  model: ollama.chat('llama3.2'), // The model instance created by the Ollama provider
  // apiKey: process.env.OLLAMA_API_KEY,
  provider: 'Ollama',
  toolChoice: 'auto', // Controls how the model handles tool/function calling
};

// const modelConfig: ModelConfig = {
//   provider: 'OPEN_AI',
//   name: 'gpt-4o-mini',
//   toolChoice: 'auto',
// };

export const chefAgent = new Agent({
  name: 'chefAgent',
  instructions:
    'You are Michel, a practical and experienced home chef who helps people cook great meals with whatever ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.',
  model: modelConfig,
});

export const memoryAgent = new Agent({
  name: 'Memory Agent',
  instructions:
    "You are an AI agent with the ability to automatically recall memories from previous interactions. You may have conversations that last hours, days, months, or years. If you don't know it already you should ask for the users name and some info about them.",
  model: modelConfig,
});
