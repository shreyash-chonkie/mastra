import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { GoogleGenerativeAISettings } from '../../types';
import { AISDK } from '../aisdk';

export type GoogleModel =
  | 'gemini-1.5-pro-latest'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash-latest'
  | 'gemini-1.5-flash'
  | 'gemini-2.0-flash-exp-latest'
  | 'gemini-2.0-flash-thinking-exp-1219'
  | 'gemini-exp-1206'
  | (string & {});

export class Gemini extends AISDK {
  constructor({
    name = 'gemini-1.5-pro-latest',
    apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    settings,
  }: { name?: GoogleModel; apiKey?: string; settings?: GoogleGenerativeAISettings } = {}) {
    const google = createGoogleGenerativeAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey,
    });

    const gemini = google(name, settings);

    super({ model: gemini });
  }
}
