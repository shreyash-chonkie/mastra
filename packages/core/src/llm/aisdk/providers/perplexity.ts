import { createPerplexity } from '@ai-sdk/perplexity';

import { AISDK } from '../aisdk';

export type PerplexityModel = 'sonar' | 'sonar-pro' | (string & {});

export class Perplexity extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: PerplexityModel;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const perplexityModel = createPerplexity({
      baseURL,
      apiKey,
    });

    super({ model: perplexityModel(name || 'sonar') });
  }
}
