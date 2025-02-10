import { Mastra } from '@mastra/core';

import { promptBuilder } from './agents/prompt-builder';
import { badAgent } from './agents/shitty-agent';

export const mastra = new Mastra({
  agents: {
    builder: promptBuilder,
    badAgent,
  },
});
