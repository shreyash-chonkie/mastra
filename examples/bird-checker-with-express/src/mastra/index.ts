import { Mastra, createLogger } from '@mastra/core';

import { birdCheckerAgent } from './agents/agent';
import * as tools from './tools';
import { getRandomImageTool } from './tools';

export const mastra = new Mastra<any, typeof tools, any>({
  tools: {
    getRandomImageTool,
  },
  agents: [birdCheckerAgent],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
