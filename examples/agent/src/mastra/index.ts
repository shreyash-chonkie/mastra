import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { browserAgent, chefAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent, browserAgent },
  logger: createLogger({ name: 'Chef', level: 'info' }),
});
