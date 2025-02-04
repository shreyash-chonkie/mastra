import { createAnthropic } from '@ai-sdk/anthropic';

import { AISDK } from '../aisdk';

export type AnthropicModel =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-sonnet-20240620'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | (string & {});

export class Anthropic extends AISDK {
  constructor({ name, apiKey }: { name?: AnthropicModel; apiKey?: string }) {
    const anthropicModel = createAnthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    super({
      model: anthropicModel(name || 'claude-3-5-sonnet-20240620'),
    });
  }
}
