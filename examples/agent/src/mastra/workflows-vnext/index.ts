import { createStep, createWorkflow } from '@mastra/core/workflows/vNext';
import { z } from 'zod';
import { chefAgent } from '../agents';
import { fromStreamText } from 'assistant-stream/ai-sdk';
import { DataStreamDecoder } from 'assistant-stream';

export const workflow = createWorkflow({
  id: 'stream-test',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
});

const step = createStep({
  id: 'step1',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData, controller, mastra }) => {
    const agent = mastra?.getAgent('chefAgent');

    const stream = await agent?.stream('WHATS UP');

    const dsResponse = stream.toDataStream().pipeThrough(new DataStreamDecoder());

    controller.merge(dsResponse);

    return {
      text: await stream.text,
    };
  },
});

workflow.then(step).commit();
