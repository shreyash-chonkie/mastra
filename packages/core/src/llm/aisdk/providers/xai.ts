import { OpenAIChatSettings } from '@ai-sdk/openai/internal';
import { createXai } from '@ai-sdk/xai';

import { AISDK } from '../aisdk';

export class XAI extends AISDK {
  constructor({
    name = 'grok-beta',
    apiKey = process.env.XAI_API_KEY ?? '',
    baseURL = 'https://api.x.ai/v1',
    settings,
  }: {
    settings?: OpenAIChatSettings;
    name?: string;
    apiKey?: string;
    baseURL?: string;
  }) {
    const xAi = createXai({
      baseURL,
      apiKey,
    });

    super({ model: xAi(name, settings) });
  }
}
