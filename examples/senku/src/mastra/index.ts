import { Mastra, createLogger } from '@mastra/core';

import { kindergartenAgent } from './agents';

export const mastra = new Mastra({
  agents: { kindergartenAgent },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
