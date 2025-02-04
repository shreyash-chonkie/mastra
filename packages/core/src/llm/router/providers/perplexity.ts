import { createPerplexity } from '@ai-sdk/perplexity';
import { ModelRouter } from '../router';

export type PerplexityModel = 'sonar' | 'sonar-pro' | (string & {});

export class Perplexity extends ModelRouter {
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
