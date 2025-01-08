import { Mastra, createLogger } from '@mastra/core';

import { AgentMastraAnthropic, AgentMastraOpenAI, AgentMastraGroq } from './agents/index';

export const mastra = new Mastra({
  agents: { AgentMastraAnthropic, AgentMastraOpenAI, AgentMastraGroq },
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
