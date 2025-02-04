import { createDeepInfra } from '@ai-sdk/deepinfra';

import { AISDK } from '../aisdk';

function deepinfra({
  name = 'meta-llama/Meta-Llama-3.1-70B-Instruct',
  apiKey = process.env.DEEPINFRA_API_KEY || '',
  baseURL = 'https://api.deepinfra.com/v1/openai',
}: {
  name?: string;
  apiKey?: string;
  baseURL?: string;
} = {}) {
  const deepinfraModel = createDeepInfra({
    baseURL,
    apiKey,
  });

  return deepinfraModel(name);
}

export class DeepInfra extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    super({ model: deepinfra({ name, apiKey, baseURL }) });
  }
}
