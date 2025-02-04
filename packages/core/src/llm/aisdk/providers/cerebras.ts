import { createCerebras } from '@ai-sdk/cerebras';

import { AISDK } from '../aisdk';

function cerebras({
  name = 'llama3.1-8b',
  apiKey = process.env.CEREBRAS_API_KEY || '',
  baseURL = 'https://api.cerebras.ai/v1',
}: {
  name?: string;
  apiKey?: string;
  baseURL?: string;
} = {}) {
  const cerebrasModel = createCerebras({
    baseURL,
    apiKey,
  });

  return cerebrasModel(name);
}

export class Cerebras extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    super({ model: cerebras({ name, apiKey, baseURL }) });
  }
}
