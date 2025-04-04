import { describe, it } from 'vitest';
import { z } from 'zod';
import { createStep, NewWorkflow } from './workflow';

describe('Workflow', () => {
  // Input and output schemas for testing
  const inputSchema = z.object({
    name: z.string(),
  });

  const outputSchema = z.object({
    result: z.string(),
  });

  const step = createStep({
    id: 'test-step',
    description: 'Test step',
    inputSchema,
    outputSchema,
    execute: async ({ inputData }) => {
      console.log('Step 1 Input Data:', inputData);
      return {
        result: 'Step 1',
      };
    },
  });

  const step2 = createStep({
    id: 'test-step2',
    description: 'Test step 2',
    inputSchema: z.object({
      result: z.string(),
    }),
    outputSchema,
    execute: async ({ inputData }) => {
      console.log('Step 2 Input Data:', inputData);
      return {
        result: `Step 2 ${inputData.result}`,
      };
    },
  });

  // Create a new workflow instance for each test
  const workflow = new NewWorkflow({
    id: 'test-workflow',
    inputSchema,
    outputSchema,
    steps: [step, step2],
  });

  workflow.then(step).then(step2).commit();

  describe('Workflow Execution', () => {
    it('Run shit', async () => {
      const run = workflow.createRun();

      const res = await run.start({
        inputData: {
          name: 'Abhi',
        },
      });

      console.log(res.steps['test-step'].status === 'success' ? res.steps['test-step'].output : 'Failed');
    }, 500000);
  });
});
