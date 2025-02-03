import { createOpenAI } from '@ai-sdk/openai';

export function openaiCompat({
  baseURL,
  apiKey,
  modelName,
  fetch,
}: {
  baseURL?: string;
  apiKey?: string;
  modelName: string;
  fetch?: typeof globalThis.fetch;
}) {
  const client = createOpenAI({
    baseURL,
    apiKey,
    fetch,
  });
  return client(modelName);
}
