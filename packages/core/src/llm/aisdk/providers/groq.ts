import { createGroq } from '@ai-sdk/groq';

import { AISDK } from '../aisdk';

function groq({
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

  return groqModel(name);
}

export class Groq extends AISDK {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: string;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    super({ model: groq({ name, apiKey, baseURL }) });
  }
}
