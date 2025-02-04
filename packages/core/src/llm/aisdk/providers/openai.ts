import { createOpenAI } from '@ai-sdk/openai';
import { OpenAIChatSettings } from '@ai-sdk/openai/internal';

import { AISDK } from '../aisdk';

export type OpenAIModel =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o1'
  | 'o1-mini'
  | 'o1-preview'
  | string;

export class OpenAI extends AISDK {
  constructor({
    name,
    apiKey,
    headers,
    fetch,
    baseURL,
    settings,
  }: {
    name?: OpenAIModel;
    apiKey?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    fetch?: typeof globalThis.fetch;
    settings?: OpenAIChatSettings;
  }) {
    const openai = createOpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      baseURL,
      headers,
      fetch,
    });

    super({
      model: openai(name || 'gpt-4o-mini', {
        structuredOutputs: true,
        ...settings,
      }),
    });
  }
}
