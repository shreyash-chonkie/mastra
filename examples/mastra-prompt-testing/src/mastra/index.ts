import { Mastra, createLogger } from '@mastra/core';

import { AgentMastra } from './agents/index';

export const mastra = new Mastra({
  agents: { AgentMastra },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
