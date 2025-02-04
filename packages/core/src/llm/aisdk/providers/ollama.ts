import { createOllama } from 'ollama-ai-provider';

import { AISDK } from '../aisdk';

export type OllamaModel = string & {};

export class OllamaAI extends AISDK {
  constructor({ name, baseURL }: { name: OllamaModel; baseURL: string }) {
    const ollama = createOllama({
      baseUrl: baseURL,
      model: name,
    });

    super({ model: ollama });
  }
}
