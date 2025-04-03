import { describe, it } from 'vitest';
import { z } from 'zod';
import { NewWorkflow } from './workflow';

describe('Workflow', () => {
  // Input and output schemas for testing
  const inputSchema = z.object({
    name: z.string(),
  });

  const outputSchema = z.object({
    result: z.string(),
  });
  // Create a new workflow instance for each test
  const workflow = new NewWorkflow({
    id: 'test-workflow',
    inputSchema,
    outputSchema,
  });

  const step = workflow.createStep({
    id: 'test-step',
    description: 'Test step',
    inputSchema,
    outputSchema,
    execute: async ({ input }) => {
      return {
        result: input.name,
      };
    },
  });

  workflow.then(step).commit();

  describe('Workflow Execution', () => {
    it('Run shit', async () => {
      const run = workflow.createRun();

      const res = await run.start({
        name: 'Abhi',
      });

      console.log(res);
    });
  });
});
