// import { confirm } from '@inquirer/prompts';
import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function workflowGen() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Lets make a workflow..\n'));

  const workflow = mastra.getWorkflow('workflowPlanner');

  const data = await input({ message: 'Enter a workflow' });

  const { runId, start } = workflow.createRun();

  console.log(runId);

  await start({
    triggerData: {
      prompt: data,
    },
  });

  const res = await workflow.watch(runId, {
    onTransition: async ({ activePaths, context }) => {
      for (const path of activePaths) {
        const ctx = context.stepResults?.[path.stepId]?.status;
        if (ctx === 'suspended') {
          if (path.stepId === 'stepA2' && ctx === 'suspended') {
            const confirmed = await confirm({ message: 'Confirm the plan?' });
            if (confirmed) {
              await workflow.resume({
                stepId: path.stepId,
                runId,
                context: {
                  confirm: true,
                },
              });
            }
          }
        }
      }
    },
  });

  console.log(JSON.stringify(res, null, 2));

  process.exit(0);
}
