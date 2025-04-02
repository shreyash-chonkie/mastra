import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { bigQueryAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { bigQueryAgent },
  logger: createLogger({ name: 'BigQuery', level: 'info' }),
});
