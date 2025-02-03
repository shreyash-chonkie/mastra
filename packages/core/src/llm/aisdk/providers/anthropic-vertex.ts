import { createAnthropicVertex } from 'anthropic-vertex-ai';

import { AISDK } from '../aisdk';

export class AnthropicVertex extends AISDK {
  constructor({
    name = 'claude-3-5-sonnet@20240620',
    region = process.env.GOOGLE_VERTEX_REGION,
    projectId = process.env.GOOGLE_VERTEX_PROJECT_ID,
    apiKey = process.env.ANTHROPIC_API_KEY ?? '',
  }: {
    name?: string;
    region?: string;
    projectId?: string;
    apiKey?: string;
  }) {
    const anthropicVertex = createAnthropicVertex({
      region,
      projectId,
      apiKey,
    });

    super({ model: anthropicVertex(name) });
  }
}
