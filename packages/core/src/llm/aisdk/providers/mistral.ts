import { createMistral } from '@ai-sdk/mistral';

import { AISDK } from '../aisdk';

function mistral({
  name = 'pixtral-large-latest',
  apiKey = process.env.MISTRAL_API_KEY || '',
  baseURL = 'https://api.mistral.ai/v1',
}: {
  name?: string;
  apiKey?: string;
  baseURL?: string;
} = {}) {
  const mistralModel = createMistral({
    baseURL,
    apiKey,
  });

  return mistralModel(name);
}

export class Mistral extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    super({ model: mistral({ name, apiKey, baseURL }) });
  }
}
