import { createStep, createWorkflow } from '@mastra/core/workflows/vNext';
import { z } from 'zod';

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  description: 'My workflow description',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
});

const step = createStep({
  id: 'my-step',
  description: 'My step description',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      result: inputData.ingredient,
    };
  },
});

myWorkflow.then(step).commit();
