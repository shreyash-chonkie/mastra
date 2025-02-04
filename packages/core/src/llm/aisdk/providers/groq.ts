import { createGroq } from '@ai-sdk/groq';

import { AISDK } from '../aisdk';

export type GroqModel =
  | 'llama3-groq-70b-8192-tool-use-preview'
  | 'llama3-groq-8b-8192-tool-use-preview'
  | 'gemma2-9b-it'
  | 'gemma-7b-it'
  | (string & {});

export class Groq extends AISDK {
  constructor({
    name = 'gemma2-9b-it',
    apiKey = process.env.GROQ_API_KEY || '',
    baseURL = 'https://api.groq.com/openai/v1',
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const groqModel = createGroq({
      baseURL,
      apiKey,
    });

    super({ model: groqModel(name) });
  }
}
