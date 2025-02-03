import { OpenAIChatSettings } from '@ai-sdk/openai/internal';

import { AISDK } from '../aisdk';

import { openaiCompat } from './openai-compat';

export class Deepseek extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
    fetch,
    settings,
  }: {
    fetch?: typeof globalThis.fetch;
    baseURL: string;
    name: string;
    apiKey?: string;
    settings?: OpenAIChatSettings;
  }) {
    super({
      model: openaiCompat({
        baseURL,
        modelName: name,
        apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
        fetch,
        settings,
      }),
    });
  }
}
