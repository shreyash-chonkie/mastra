import { createPerplexity } from '@ai-sdk/perplexity';

import { AISDK } from '../aisdk';

export type PerplexityModel =
  | 'llama-3.1-sonar-small-128k-online'
  | 'llama-3.1-sonar-large-128k-online'
  | 'llama-3.1-sonar-huge-128k-online'
  | 'llama-3.1-sonar-small-128k-chat'
  | 'llama-3.1-sonar-large-128k-chat'
  | 'llama-3.1-8b-instruct'
  | 'llama-3.1-70b-instruct'
  | 'sonar'
  | 'sonar-pro'
  | (string & {});

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
