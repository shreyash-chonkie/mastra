import { createTogetherAI } from '@ai-sdk/togetherai';

import { AISDK } from '../aisdk';

function togetherai({
  name = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  apiKey = process.env.TOGETHER_AI_API_KEY || '',
  baseURL = 'https://api.together.xyz/v1',
}: {
  name?: string;
  apiKey?: string;
  baseURL?: string;
} = {}) {
  const togetheraiModel = createTogetherAI({
    baseURL,
    apiKey,
  });

  return togetheraiModel(name);
}

export class TogetherAI extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    super({ model: togetherai({ name, apiKey, baseURL }) });
  }
}
