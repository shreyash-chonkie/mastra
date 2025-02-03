import { createOpenAI } from '@ai-sdk/openai';

import { AISDK } from '../aisdk';

export function openai({ name, apiKey }: { name?: string; apiKey?: string } = {}) {
  const openai = createOpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  });

  return openai(name || 'gpt-4o-2024-08-06', {
    structuredOutputs: true,
  });
}

export class OpenAI extends AISDK {
  constructor({ name, apiKey }: { name?: string; apiKey?: string }) {
    super({ model: openai({ name, apiKey }) });
  }
}
