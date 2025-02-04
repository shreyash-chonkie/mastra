import { createAnthropicVertex } from 'anthropic-vertex-ai';

import { ModelRouter } from '../router';

export type AnthropicVertexModel =
  | 'claude-3-5-sonnet@20240620'
  | 'claude-3-opus@20240229'
  | 'claude-3-sonnet@20240229'
  | 'claude-3-haiku@20240307'
  | (string & {});

export class AnthropicVertex extends ModelRouter {
  constructor({
    name = 'claude-3-5-sonnet@20240620',
    region = process.env.GOOGLE_VERTEX_REGION,
    projectId = process.env.GOOGLE_VERTEX_PROJECT_ID,
    apiKey = process.env.ANTHROPIC_API_KEY ?? '',
  }: {
    name?: AnthropicVertexModel;
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
