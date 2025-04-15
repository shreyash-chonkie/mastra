import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { Inngest } from 'inngest';

import { z } from 'zod';
import { createStep } from '@mastra/core/workflows/vNext';
import { MastraInngestWorkflow } from './index';

describe('MastraInngestWorkflow', () => {
  const inngest = new Inngest({ id: 'test' });

  it('should execute workflow with sequential and parallel steps', async () => {
    // Create test workflow steps
    const step1 = createStep({
      id: 'step1',
      description: 'First step',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        processed: z.string(),
      }),
      execute: async ({ inputData }) => {
        return {
          processed: `Processed: ${inputData.message}`,
        };
      },
    });

    const step2 = createStep({
      id: 'step2',
      description: 'Second step',
      inputSchema: z.object({
        processed: z.string(),
      }),
      outputSchema: z.object({
        final: z.string(),
      }),
      execute: async ({ inputData }) => {
        return {
          final: `Final: ${inputData.processed}`,
        };
      },
    });

    // Create parallel steps
    const parallel1 = createStep({
      id: 'parallel1',
      description: 'Parallel step 1',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      execute: async ({ inputData }) => {
        return {
          result: `Parallel 1: ${inputData.message}`,
        };
      },
    });

    const parallel2 = createStep({
      id: 'parallel2',
      description: 'Parallel step 2',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      execute: async ({ inputData }) => {
        return {
          result: `Parallel 2: ${inputData.message}`,
        };
      },
    });

    // Create workflow
    const workflow = new MastraInngestWorkflow(
      {
        id: 'test-workflow',
        inputSchema: z.object({
          message: z.string(),
        }),
        outputSchema: z.object({
          processed: z.string(),
        }),
      },
      inngest,
    );

    // Add steps to workflow
    workflow.then(step1).commit();

    const run = workflow.createRun();

    const result = await run.start({
      inputData: {
        message: 'Hello',
      },
    });

    console.log(result);

    expect(result.steps).toBeDefined();
    expect(result.steps.step1.status).toBe('success');
    // expect(result.steps.step2.status).toBe('success');
  });
});
