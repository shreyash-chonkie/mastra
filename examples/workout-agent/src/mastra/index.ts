import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { workoutAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { workoutAgent },
  logger: createLogger({ name: 'Workout Coach', level: 'info' }),
});
