import { describe, it } from 'vitest';
import { z } from 'zod';
import { createStep, createWorkflow, NewWorkflow } from './workflow';

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
        result: `Step 2 ${inputData.resultz}, alt: ${alt?.resultz}`,
      };
    },
  });

  const step3 = createStep({
    id: 'test-step3',
    description: 'Test step 3',
    inputSchema: z.object({
      result: z.string(),
    }),
    outputSchema: z.object({
      thing: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log('Step 3 Input Data:', inputData);
      return {
        thing: `Step 3 ${inputData.result}`,
      };
    },
  });

  const step4 = createStep({
    id: 'test-step4',
    description: 'Test step 4',
    inputSchema: z.object({
      result: z.string(),
    }),
    outputSchema: z.object({
      thirdResult: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log('Step 4 Input Data:', inputData);
      return {
        thirdResult: `Step 4 ${inputData.result}`,
      };
    },
  });

  const step5 = createStep({
    id: 'test-step5',
    description: 'Test step 4',
    inputSchema: z.object({
      'test-step3': z.object({
        thing: z.string(),
      }),
      'test-step4': z.object({
        thirdResult: z.string(),
      }),
    }),
    outputSchema: z.object({
      other: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log('Step 5 Input Data:', inputData);
      return {
        other: `Step 5 ${JSON.stringify(inputData)}`,
      };
    },
  });

  // Create a new workflow instance for each test
  const workflowA = new NewWorkflow({
    id: 'test-workflow-a',
    inputSchema,
    outputSchema,
    steps: [step, step2, step3, step5],
  });

  workflowA.then(step).then(step2).commit();

  const workflowB = new NewWorkflow({
    id: 'test-workflow-b',
    inputSchema,
    outputSchema,
    steps: [step, step2, step3, step5],
  });
  workflowB.then(step).parallel([step4, step2]).then(step5).commit();

  const workflowC = new NewWorkflow({
    id: 'test-workflow-c',
    inputSchema,
    outputSchema,
    steps: [step, step2, step3, step4, step5],
  });
  workflowC
    .then(step)
    .then(step2)
    .branch([
      [
        async ({ inputData }) => {
          return inputData.result === 'Abhi';
        },
        step3,
      ],
      [
        async ({ inputData }) => {
          return inputData.result !== 'Abhi';
        },
        step4,
      ],
    ])
    .then(step5)
    .commit();

  const stepDouble = createStep({
    id: 'test-step-double',
    description: 'Test step double',
    inputSchema: z.object({
      'test-step3': z.object({
        thing: z.string(),
      }),
      'nested-workflow-b': z.object({
        'test-step3': z.object({
          thing: z.string(),
        }),
        'test-step4': z.object({
          thirdResult: z.string(),
        }),
      }),
    }),
    outputSchema: z.object({
      result: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log('Step double', inputData);
      return { result: `Step double ${inputData['test-step3'].thing}` };
    },
  });

  let isSuspended = false;
  const stepSuspend = createStep({
    id: 'test-step-suspend',
    description: 'Test step suspend',
    inputSchema: z.object({
      resultz: z.string(),
    }),
    outputSchema: z.object({
      result: z.string(),
    }),
    execute: async ({ inputData, suspend }) => {
      if (isSuspended) {
        return { result: `Step suspend ${JSON.stringify(inputData)}` };
      } else {
        isSuspended = true;
        await suspend({ suspendPayloadTest: 'hello' });
        // TODO: this is annoying to have to return
        return { result: 'SUSPENDED' };
      }
    },
  });

  const nestedWorkflowB = createWorkflow({
    id: 'nested-workflow-b',
    inputSchema: z.object({
      result: z.string(),
    }),
    outputSchema: z.object({
      'test-step3': z.object({
        thing: z.string(),
      }),
      'test-step4': z.object({
        thirdResult: z.string(),
      }),
    }),
    steps: [step3, step4],
  })
    .parallel([step3, step4])
    .commit();

  const nestedWorkflowA = createWorkflow({
    id: 'nested-workflow-a',
    inputSchema: z.object({
      name: z.string(),
    }),
    outputSchema: z.object({
      result: z.string(),
    }),
    steps: [step, step2, step3, nestedWorkflowB, stepDouble],
  })
    .then(step)
    .then(step2)
    .parallel([step3, nestedWorkflowB])
    .then(stepDouble)
    .commit();

  const workflowD = createWorkflow({
    id: 'test-workflow-d',
    inputSchema: z.object({
      name: z.string(),
    }),
    outputSchema: z.object({
      thing: z.string(),
    }),
    steps: [nestedWorkflowA, step3],
  });

  workflowD.then(nestedWorkflowA).then(step3).commit();

  const workflowE = createWorkflow({
    id: 'test-workflow-e',
    inputSchema: z.object({
      name: z.string(),
    }),
    outputSchema: z.object({ result: z.string() }),
    steps: [step, stepSuspend],
  })
    .then(step)
    .then(stepSuspend)
    .commit();

  describe('Workflow Execution', () => {
    it('Run shit', async () => {
      const run = workflowA.createRun();

      const res = await run.start({
        inputData: {
          name: 'Abhi',
        },
      });

      console.dir(res, { depth: null });

      const runB = workflowB.createRun();

      const resB = await runB.start({
        inputData: {
          name: 'Abhi',
        },
      });
      console.dir({ resB }, { depth: null });

      const runC = workflowC.createRun();

      const resC = await runC.start({
        inputData: {
          name: 'Abhi',
        },
      });
      console.dir({ resC }, { depth: null });

      const runD = workflowD.createRun();

      const resD = await runD.start({
        inputData: {
          name: 'Abhi',
        },
      });
      console.dir({ resD }, { depth: null });

      const runE = workflowE.createRun();
      const resE = await runE.start({
        inputData: { name: 'Abhi' },
      });
      console.dir({ resE }, { depth: null });

      const resumeE = await runE.resume({
        inputData: { result: 'Coming from resume' },
        stepId: 'test-step-suspend',
      });
      console.dir({ resumeE }, { depth: null });
    }, 500000);
  });
});
