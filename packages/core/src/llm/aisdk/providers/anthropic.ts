import { createAnthropic } from '@ai-sdk/anthropic';

import { AISDK } from '../aisdk';

function anthropic({ name, apiKey }: { name?: string; apiKey?: string } = {}) {
  const anthropicModel = createAnthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
  });
  return anthropicModel(name || 'claude-3-5-sonnet-20240620');
}

export class Anthropic extends AISDK {
  constructor({ name, apiKey }: { name?: string; apiKey?: string }) {
    super({ model: anthropic({ name, apiKey }) });
  }
}
