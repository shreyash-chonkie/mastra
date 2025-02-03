import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { GoogleGenerativeAISettings } from '../../types';
import { AISDK } from '../aisdk';

export function gemini({
  name,
  apiKey,
  settings,
}: { name?: string; apiKey?: string; settings?: GoogleGenerativeAISettings } = {}) {
  const google = createGoogleGenerativeAI({
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
  });
  return google(name || 'gemini-1.5-pro-latest', settings);
}

export class Gemini extends AISDK {
  constructor({
    name,
    apiKey,
    settings,
  }: { name?: string; apiKey?: string; settings?: GoogleGenerativeAISettings } = {}) {
    super({ model: gemini({ name, apiKey, settings }) });
  }
}
