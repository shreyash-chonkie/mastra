import { createDeepSeek } from '@ai-sdk/deepseek';

import { AISDK } from '../aisdk';

function deepseek({
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

  return deepseekModel(name);
}

export class DeepSeek extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    super({ model: deepseek({ name, apiKey, baseURL }) });
  }
}
