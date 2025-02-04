import { createOllama } from 'ollama-ai-provider';
import { AISDK } from '../aisdk';

export type OllamaModel = string & {};

export class OllamaAI extends AISDK {
  constructor({ name, baseURL, headers, fetch }: {
    name: OllamaModel;
    baseURL: string
    headers?: Record<string, string>;
    fetch?: typeof globalThis.fetch
  }) {
    const ollama = createOllama({
      baseURL,
      fetch,
      headers,
    });

    super({ model: ollama(name) });
  }
}
