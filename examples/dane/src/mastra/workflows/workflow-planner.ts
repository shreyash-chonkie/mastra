import { Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';

export const workflowPlanner = new Workflow({
  name: 'workflow-planner',
  triggerSchema: z.object({
    prompt: z.string(),
  }),
});

const stepA1 = new Step({
  id: 'stepA1',
  description: 'Starts the message',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ mastra, context }) => {
    const response = await mastra?.agents?.daneWrittenWorkflowPlanner?.generate(
      context.machineContext?.triggerData.prompt,
    );

    console.log(chalk.green(response?.text));

    return {
      message: response?.text!,
    };
  },
});

const stepA2 = new Step({
  id: 'stepA2',
  description: 'Confirm the plan',
  execute: async ({ context, suspend }) => {
    if (
      context.machineContext?.stepResults?.stepA2?.status === 'success' &&
      context.machineContext?.stepResults?.stepA2?.payload.confirm
    ) {
      return {
        workflow_finished: true,
      };
    }

    // suspend the workflow
    console.log('Plan not confirmed');

    await suspend();

    return {
      workflow_finished: false,
    };
  },
});

const stepA3 = new Step({
  id: 'stepA3',
  description: 'Create mastra workflow',
  execute: async ({ context, mastra }) => {
    if (
      context.machineContext?.stepResults?.stepA1?.status === 'success' &&
      context.machineContext?.stepResults?.stepA1?.payload.message
    ) {
      console.log(chalk.green('Creating mastra workflow'));

      const docs = await (await fetch('https://mastra.ai/llms.txt')).text();

      const response = await mastra?.agents?.daneWorkflowPlanner?.generate(
        `
        Docs: ${docs}
        ${context.machineContext?.stepResults?.stepA1?.payload.message}
      `,
        {
          output: z.object({
            workflow_code: z.string(),
            commentrary: z.string(),
          }),
        },
      );
      console.log(chalk.green(JSON.stringify(response?.object, null, 2)));

      return response?.object;
    }
  },
});

const stepA4 = new Step({
  id: 'stepA4',
  description: 'Write workflow',
  execute: async ({ context }) => {
    const res = context.machineContext?.getStepPayload<{ workflow_code: string }>('stepA3');
    writeFileSync(path.join(process.cwd(), 'test-workflow.ts'), res?.workflow_code!);
  },
});

workflowPlanner
  .step(stepA1)
  .then(stepA2)
  .then(stepA3, {
    when: ({ context }) => {
      return (
        context?.stepResults?.stepA2?.status === 'success' && context?.stepResults?.stepA2?.payload.workflow_finished
      );
    },
  })
  .then(stepA4)
  .commit();
