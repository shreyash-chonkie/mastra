import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { workflow } from './workflows-vnext';
import { chefAgent, chefAgentResponses } from './agents/index';

export const mastra = new Mastra({
  agents: { chefAgent, chefAgentResponses },
  logger: createLogger({ name: 'Chef', level: 'info' }),
  vnext_workflows: {
    workflow,
  },
  serverMiddleware: [
    {
      handler: (c, next) => {
        console.log('Middleware called');
        return next();
      },
    },
  ],
});
