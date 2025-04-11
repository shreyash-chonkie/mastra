import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { commitCategorizer, summarizer } from './agents/index';
import { workflow } from './workflows';

export const mastra = new Mastra({
  agents: { commitCategorizer, summarizer },
  workflows: {
    workflow,
  },
  logger: createLogger({ name: 'Commit Categorizer', level: 'info' }),
});
