import { createDeepSeek } from '@ai-sdk/deepseek';

import { AISDK } from '../aisdk';

export type DeepseekModel = 'deepseek-chat' | 'deepseek-reasoner' | (string & {});

export class DeepSeek extends AISDK {
  constructor({
    name = 'deepseek-chat',
    apiKey = process.env.DEEPSEEK_API_KEY || '',
    baseURL = 'https://api.deepseek.com/v1',
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const deepseekModel = createDeepSeek({
      baseURL,
      apiKey,
    });

    super({ model: deepseekModel(name) });
  }
}
