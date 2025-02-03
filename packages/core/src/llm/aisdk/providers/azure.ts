import { createAzure } from '@ai-sdk/azure';
import { OpenAIChatSettings } from '@ai-sdk/openai/internal';

import { AISDK } from '../aisdk';

export class Azure extends AISDK {
  constructor({
    name = 'gpt-35-turbo-instruct',
    resourceName = process.env.AZURE_RESOURCE_NAME || '',
    apiKey = process.env.AZURE_API_KEY || '',
    apiVersion,
    baseURL,
    headers,
    fetch,
    settings,
  }: {
    name?: string;
    resourceName?: string;
    apiKey?: string;
    apiVersion?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    fetch?: typeof globalThis.fetch;
    settings?: OpenAIChatSettings;
  }) {
    const azure = createAzure({
      resourceName,
      apiKey,
      apiVersion,
      baseURL,
      headers,
      fetch,
    });

    super({ model: azure(name, settings) });
  }
}
