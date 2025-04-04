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
    outputSchema: z.object({
      resultz: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log('Step 1 Input Data:', inputData);
      return {
        resultz: 'Step 1',
      };
    },
  });

  const step2 = createStep({
    id: 'test-step2',
    description: 'Test step 2',
    inputSchema: z.object({
      resultz: z.string(),
    }),
    outputSchema,
    execute: async ({ inputData, getStepResult }) => {
      const alt = getStepResult(step);
      console.log('alt', alt);
      console.log('Step 2 Input Data:', inputData);
      return {
        result: `Step 2 ${inputData.resultz}`,
      };
    },
  });

  const step3 = createStep({
    id: 'test-step3',
    description: 'Test step 3',
    inputSchema: z.object({
      resultz: z.string(),
    }),
    outputSchema: z.object({
      thing: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log('Step 3 Input Data:', inputData);
      return {
        thing: `Step 3 ${inputData.resultz}`,
      };
    },
  });

  const step4 = createStep({
    id: 'test-step4',
    description: 'Test step 4',
    inputSchema: z.object({
      outputs: z.tuple([
        z.object({
          result: z.string(),
        }),
        z.object({
          thing: z.string(),
        }),
      ]),
    }),
    outputSchema: z.object({
      other: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log('Step 4 Input Data:', inputData);
      return {
        other: `Step 4 ${JSON.stringify(inputData)}`,
      };
    },
  });

  // Create a new workflow instance for each test
  const workflow = new NewWorkflow({
    id: 'test-workflow',
    inputSchema,
    outputSchema,
    steps: [step, step2, step3, step4],
  });

  workflow.then(step).parallel([step2, step3]).then(step4).commit();

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
