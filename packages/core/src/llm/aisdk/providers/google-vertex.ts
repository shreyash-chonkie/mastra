import { createVertex } from '@ai-sdk/google-vertex';
import { LanguageModel } from 'ai';

import { AISDK } from '../aisdk';

import { GoogleVertexSettings } from './types';

function vertex({
  name = 'gemini-1.5-pro',
  project = process.env.GOOGLE_VERTEX_PROJECT || '',
  location = process.env.GOOGLE_VERTEX_LOCATION || 'us-central1',
  settings,
}: {
  name?: string;
  project?: string;
  location?: string;
  settings?: GoogleVertexSettings;
} = {}) {
  const vertexModel = createVertex({
    project,
    location,
  });

  return vertexModel(name, settings);
}

export class GoogleVertex extends AISDK {
  constructor({
    name,
    project,
    location,
    settings,
  }: {
    name?: string;
    project?: string;
    location?: string;
    settings?: GoogleVertexSettings;
  } = {}) {
    super({
      model: vertex({
        name,
        project,
        location,
        settings,
      }) as LanguageModel,
    });
  }
}
