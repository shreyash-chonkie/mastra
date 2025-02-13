import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { haikuAgent } from './agents/haiku';
import { chefAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent, haikuAgent },
  logger: createLogger({ name: 'Chef', level: 'debug' }),
});
