import { createPerplexity } from '@ai-sdk/perplexity';

import { AISDK } from '../aisdk';

function perplexity({
  name = 'sonar-pro',
  apiKey = process.env.PERPLEXITY_API_KEY || '',
  baseURL = 'https://api.perplexity.ai',
}: {
  name?: string;
  apiKey?: string;
  baseURL?: string;
} = {}) {
  const perplexityModel = createPerplexity({
    baseURL,
    apiKey,
  });

  return perplexityModel(name);
}

export class Perplexity extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    super({ model: perplexity({ name, apiKey, baseURL }) });
  }
}
