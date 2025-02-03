import { createCohere } from '@ai-sdk/cohere';

import { AISDK } from '../aisdk';

export class Cohere extends AISDK {
  constructor({
    name = 'command-r-plus',
    apiKey = process.env.COHERE_API_KEY || '',
    baseURL = 'https://api.cohere.com/v2',
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  }) {
    const cohere = createCohere({
      baseURL,
      apiKey,
    });

    super({ model: cohere(name) });
  }
}
