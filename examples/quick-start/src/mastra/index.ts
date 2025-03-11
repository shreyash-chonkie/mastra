import { createLogger, Mastra } from '@mastra/core';
import { catOne } from './agents/agent.js';

export const mastra = new Mastra({
  agents: { catOne },

  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
