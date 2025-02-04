import { createOpenAI } from '@ai-sdk/openai';
import { OpenAIChatSettings } from '@ai-sdk/openai/internal';

import { AISDK } from '../aisdk';

function openai({ name, apiKey, settings }: { name?: string; apiKey?: string; settings?: OpenAIChatSettings } = {}) {
  const openai = createOpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  });

  return openai(name || 'gpt-4o-2024-08-06', {
    structuredOutputs: true,
    ...settings,
  });
}

export class OpenAI extends AISDK {
  constructor({ name, apiKey, settings }: { name?: string; apiKey?: string; settings?: OpenAIChatSettings }) {
    super({ model: openai({ name, apiKey, settings }) });
  }
}
