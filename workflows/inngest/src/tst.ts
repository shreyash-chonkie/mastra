import { z } from 'zod';
import { createStep } from '@mastra/core/workflows/vNext';
import { MastraInngestWorkflow } from './index';
import { Inngest } from 'inngest';

const inngest = new Inngest({ id: 'test' });
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
    final: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      result: `Parallel 1: ${inputData?.final}`,
    };
  },
});

const parallel2 = createStep({
  id: 'parallel2',
  description: 'Parallel step 2',
  inputSchema: z.object({
    final: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      result: `Parallel 2: ${inputData?.final}`,
    };
  },
});

const finalStep = createStep({
  id: 'final',
  description: 'Final step',
  inputSchema: z.object({
    parallel1: z.object({ result: z.string() }),
    parallel2: z.object({ result: z.string() }),
  }),
  outputSchema: z.object({
    final: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      final: `Final: ${inputData.parallel1.result} ${inputData.parallel2.result}`,
    };
  },
});

// Create workflow
const workflow = new MastraInngestWorkflow(inngest, {
  id: 'test-workflow',
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    final: z.string(),
  }),
});

// Add steps to workflow
workflow.then(step1).then(step2).parallel([parallel1, parallel2]).then(finalStep).commit();

async function test() {
  const run = workflow.createRun();

  const result = await run.start({
    inputData: {
      message: 'Hello',
    },
  });

  console.log(result);
}

test();
