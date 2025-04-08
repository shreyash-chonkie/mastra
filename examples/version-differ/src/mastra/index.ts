import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { commitCategorizer, summarizer } from './agents/index';

export const mastra = new Mastra({
  agents: { commitCategorizer, summarizer },
  logger: createLogger({ name: 'Commit Categorizer', level: 'info' }),
});
