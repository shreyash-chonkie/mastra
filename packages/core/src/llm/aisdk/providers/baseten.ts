import { OpenAIChatSettings } from '@ai-sdk/openai/internal';

import { AISDK } from '../aisdk';

import { openaiCompat } from './openai-compat';

function baseten({
  name = 'llama-3.1-70b-instruct',
  apiKey = process.env.BASETEN_API_KEY || '',
  baseURL = 'https://bridge.baseten.co/v1/direct',
  fetch,
  settings,
}: {
  name?: string;
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
  settings?: OpenAIChatSettings;
} = {}) {
  if (fetch) {
    throw new Error(
      'Custom fetch is required to use BaseTen. See https://docs.baseten.co/api-reference/openai for more information',
    );
  }

  return openaiCompat({
    baseURL,
    modelName: name,
    apiKey,
    fetch,
    settings,
  });
}

export class BaseTen extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
    fetch,
    settings,
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
    fetch?: typeof globalThis.fetch;
    settings?: OpenAIChatSettings;
  } = {}) {
    super({ model: baseten({ name, apiKey, baseURL, fetch, settings }) });
  }
}
