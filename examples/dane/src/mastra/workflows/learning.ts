import { Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import { z } from 'zod';

export const learningWorkflow = new Workflow({
  name: 'learning',
});

const questionStep = new Step({
  id: 'question',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ mastra }) => {
    const question = mastra?.agents?.selfEvaluatingDaneQuestion;

    if (!question) {
      return { message: 'Failure in workflow' };
    }

    console.log(
      chalk.blue(`
            ██████  ██    ██ ███████ ███████ ████████ ██  ██████  ███    ██ ███████ 
           ██    ██ ██    ██ ██      ██         ██    ██ ██    ██ ████   ██ ██      
           ██    ██ ██    ██ █████   ███████    ██    ██ ██    ██ ██ ██  ██ ███████ 
           ██ ▄▄ ██ ██    ██ ██           ██    ██    ██ ██    ██ ██  ██ ██      ██ 
            ██████   ██████  ███████ ███████    ██    ██  ██████  ██   ████ ███████ 
               ▀▀                                                                     `),
    );

    const res = await question.stream(`
            {
                    qanda: []
                    time: ${new Date().toISOString()}
                    open_issues: []
                    todo_list: []
                    completed_tasks: []
                    failed_tasks: []
            }    
        `);

    let txt = ``;

    for await (const chunk of res.textStream) {
      txt += chunk;
      process.stdout.write(chalk.green(chunk));
    }

    console.log(chalk.green(`\n`));

    return { message: txt };
  },
});

const answerStep = new Step({
  id: 'answer',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ mastra, context }) => {
    if (context?.machineContext?.stepResults?.nextTask?.status !== 'success') {
      return { message: 'Failure in workflow' };
    }

    const answer = mastra?.agents?.selfEvaluatingDaneAnswer;

    if (!answer) {
      return { message: 'Failure in workflow' };
    }

    console.log(
      chalk.cyan(`
            ██████  ██ ███████  ██████  ██████  ██    ██ ███████ ██████  ██    ██ 
            ██   ██ ██ ██      ██      ██    ██ ██    ██ ██      ██   ██  ██  ██  
            ██   ██ ██ ███████ ██      ██    ██ ██    ██ █████   ██████    ████   
            ██   ██ ██      ██ ██      ██    ██  ██  ██  ██      ██   ██    ██    
            ██████  ██ ███████  ██████  ██████    ████   ███████ ██   ██    ██    `),
    );

    const res = await answer.stream(context.machineContext?.stepResults?.nextTask?.payload?.message);

    console.log(chalk.green(`\nDane: \n`));

    let txt = ``;

    for await (const chunk of res.textStream) {
      txt += chunk;
      process.stdout.write(chalk.green(chunk));
    }

    console.log(chalk.green(`\n`));

    return { message: txt };
  },
});

const nextTasks = new Step({
  id: 'nextTask',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ mastra, context }) => {
    if (context?.machineContext?.stepResults?.question?.status !== 'success') {
      return { message: 'Failure in workflow' };
    }

    const evalsAgent = mastra?.agents?.selfEvaluatingDane;

    if (!evalsAgent) {
      return { message: 'Failure in workflow' };
    }

    console.log(
      chalk.red(`
            ██████  ██       █████  ███    ██ ███    ██ ██ ███    ██  ██████  
            ██   ██ ██      ██   ██ ████   ██ ████   ██ ██ ████   ██ ██       
            ██████  ██      ███████ ██ ██  ██ ██ ██  ██ ██ ██ ██  ██ ██   ███ 
            ██      ██      ██   ██ ██  ██ ██ ██  ██ ██ ██ ██  ██ ██ ██    ██ 
            ██      ███████ ██   ██ ██   ████ ██   ████ ██ ██   ████  ██████  `),
    );

    const res = await evalsAgent.stream(`
            {
                questions: ${context?.machineContext?.stepResults?.question?.payload?.message}
                answers: []
                completed_tasks: []
                failed_tasks: []
            }
        `);

    console.log(chalk.green(`\nDane: \n`));

    let txt = ``;

    for await (const chunk of res.textStream) {
      txt += chunk;
      process.stdout.write(chalk.green(chunk));
    }

    console.log(chalk.green(`\n`));

    return { message: txt };
  },
});

const implementTask = new Step({
  id: 'implement',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ mastra, context }) => {
    if (
      context?.machineContext?.stepResults?.nextTask?.status !== 'success' ||
      context?.machineContext?.stepResults?.question?.status !== 'success' ||
      context?.machineContext?.stepResults?.answer?.status !== 'success'
    ) {
      return { message: 'Failure in workflow' };
    }

    const implementAgent = mastra?.agents?.selfEvaluatingDaneImplement;

    if (!implementAgent) {
      return { message: 'Failure in workflow' };
    }

    console.log(
      chalk.blue(`
            ███    ███  █████  ██   ██ ███████     ███    ███  ██████  ██    ██ ███████ ███████ 
            ████  ████ ██   ██ ██  ██  ██          ████  ████ ██    ██ ██    ██ ██      ██      
            ██ ████ ██ ███████ █████   █████       ██ ████ ██ ██    ██ ██    ██ █████   ███████ 
            ██  ██  ██ ██   ██ ██  ██  ██          ██  ██  ██ ██    ██  ██  ██  ██           ██ 
            ██      ██ ██   ██ ██   ██ ███████     ██      ██  ██████    ████   ███████ ███████ `),
    );

    const res = await implementAgent.stream(`
            {
                task: ${context?.machineContext?.stepResults?.nextTask?.payload?.message}
                answer: ${context?.machineContext?.stepResults?.answer?.payload?.message},
                questions: ${context?.machineContext?.stepResults?.question?.payload?.message}
                completed_tasks: []
                failed_tasks: []
            }

            Give me an object in response updating after task completion. Write it to the project as json.
        `);

    console.log(chalk.green(`\nDane: \n`));

    let txt = ``;

    for await (const chunk of res.textStream) {
      txt += chunk;
      process.stdout.write(chalk.green(chunk));
    }

    console.log(chalk.green(`\n`));

    return { message: txt };
  },
});

learningWorkflow
  .step(questionStep)
  .after(questionStep)
  .step(nextTasks)
  .after(nextTasks)
  .step(answerStep)
  .after(answerStep)
  .step(implementTask)
  .after(implementTask)
  .step(questionStep)
  .commit();
