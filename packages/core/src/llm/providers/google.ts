import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { AISDK } from '../aisdk';

export function gemini({ name, apiKey }: { name?: string; apiKey?: string } = {}) {
  const google = createGoogleGenerativeAI({
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
  });
  return google(name || 'gemini-1.5-pro-latest');
}

export class Gemini extends AISDK {
  constructor({ name, apiKey }: { name?: string; apiKey?: string }) {
    super({ model: gemini({ name, apiKey }) });
  }
}
