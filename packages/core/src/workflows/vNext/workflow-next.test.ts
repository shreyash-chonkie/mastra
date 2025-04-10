import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createStep, createWorkflow, NewWorkflow } from './workflow';
import { subscribe } from 'diagnostics_channel';
import { Step } from '../step';

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

  const testWorkflowBFinalStep = createStep({
    id: 'test-step-final',
    description: 'Test step final',
    inputSchema: z.object({
      'test-step2': z.object({
        result: z.string(),
      }),
    }),
    outputSchema: z.object({
      thingy: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log('test-step-final');
      return {
        thingy: `Step final ${inputData['test-step2'].result}`,
      };
    },
  });

  const workflowB = new NewWorkflow({
    id: 'test-workflow-b',
    inputSchema,
    outputSchema: z.object({
      'test-step2': z.object({
        result: z.string(),
      }),
    }),
    steps: [step, step2, step3, step5],
  });
  workflowB
    .then(step)
    .parallel([step2])
    .then(testWorkflowBFinalStep)
    .map({
      result: {
        step: testWorkflowBFinalStep,
        path: 'thingy',
      },
    })
    .then(step4)
    .commit();

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

  let isSuspended2 = false;
  const stepSuspend2 = createStep({
    id: 'test-step-suspend2',
    description: 'Test step suspend',
    inputSchema: z.object({
      thing: z.string(),
    }),
    outputSchema: z.object({
      result: z.string(),
    }),
    execute: async ({ inputData, suspend }) => {
      if (isSuspended2) {
        return { result: `Step suspend ${JSON.stringify(inputData)}` };
      } else {
        isSuspended2 = true;
        await suspend({ suspendPayloadTest: 'hello2' });
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

  const nestedWorkflowSuspend = createWorkflow({
    id: 'nested-workflow-hmm',
    inputSchema: z.object({
      result: z.string(),
    }),
    outputSchema: z.object({
      result: z.string(),
    }),
    steps: [stepSuspend2],
  })
    .then(step3)
    .then(stepSuspend2)
    .commit();

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
    .parallel([nestedWorkflowSuspend])
    .map({
      result: {
        step: nestedWorkflowSuspend,
        path: 'result',
      },
    })
    .commit();

  const repeatStep = createStep({
    id: 'repeat-step',
    description: 'Repeat step',
    inputSchema: z.object({
      result: z.number(),
    }),
    outputSchema: z.object({
      result: z.number(),
    }),
    execute: async ({ inputData }) => {
      console.log('repeat step', inputData);
      return { result: inputData.result + 1 };
    },
  });
  const repeatStep2 = createStep({
    id: 'repeat-step2',
    description: 'Repeat step',
    inputSchema: z.object({
      result: z.number(),
    }),
    outputSchema: z.object({
      result: z.number(),
    }),
    execute: async ({ inputData }) => {
      console.log('repeat step', inputData);
      return { result: inputData.result + 1 };
    },
  });

  const workflowF = createWorkflow({
    id: 'test-workflow-f',
    inputSchema: z.object({
      result: z.number(),
    }),
    outputSchema: z.object({ result: z.string() }),
    steps: [],
  })
    .dowhile(repeatStep, ({ inputData }) => {
      console.log('doWhile inputData', inputData);
      return Promise.resolve(inputData.result < 10);
    })
    .dountil(repeatStep2, ({ inputData }) => {
      console.log('doUntil inputData', inputData);
      return Promise.resolve(inputData.result >= 12);
    })
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
      runE.watch(event => {
        console.log('event', event);
      });
      const resE = await runE.start({
        inputData: { name: 'Abhi' },
      });
      console.dir({ resE }, { depth: null });

      const resumeE1 = await runE.resume({
        inputData: { resultz: 'Coming from resume' },
        step: stepSuspend,
      });
      console.dir({ resumeE1 }, { depth: null });

      const resumeE2 = await runE.resume({
        inputData: { thing: 'Coming from resume2' },
        step: [nestedWorkflowSuspend, stepSuspend2],
      });
      console.dir({ resumeE2 }, { depth: null });

      const runF = workflowF.createRun();
      const resF = await runF.start({
        inputData: { result: 0 },
      });
      console.dir({ resF }, { depth: null });
    }, 500000);
  });

  describe('Basic Workflow Execution', () => {
    it('should execute a single step workflow successfully', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1).commit();

      const run = workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
      });
    });

    it('should execute multiple steps in parallel', async () => {
      const step1Action = vi.fn().mockImplementation(async () => {
        return { value: 'step1' };
      });
      const step2Action = vi.fn().mockImplementation(async () => {
        return { value: 'step2' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

      const run = workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.steps).toEqual({
        input: {},
        step1: { status: 'success', output: { value: 'step1' } },
        step2: { status: 'success', output: { value: 'step2' } },
      });
    });

    it('should execute steps sequentially', async () => {
      const executionOrder: string[] = [];

      const step1Action = vi.fn().mockImplementation(() => {
        executionOrder.push('step1');
        return { value: 'step1' };
      });
      const step2Action = vi.fn().mockImplementation(() => {
        executionOrder.push('step2');
        return { value: 'step2' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1, step2],
      });

      workflow.then(step1).then(step2).commit();

      const run = workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(executionOrder).toEqual(['step1', 'step2']);
      expect(result.steps).toEqual({
        input: {},
        step1: { status: 'success', output: { value: 'step1' } },
        step2: { status: 'success', output: { value: 'step2' } },
      });
    });

    describe('Variable Resolution', () => {
      it('should resolve trigger data', async () => {
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: z.object({ inputData: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute,
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ inputData: z.string() }),
          outputSchema: z.object({}),
        });

        workflow.then(step1).then(step2).commit();

        const run = workflow.createRun();
        const result = await run.start({ inputData: { inputData: 'test-input' } });

        expect(result.steps.step1).toEqual({ status: 'success', output: { result: 'success' } });
        expect(result.steps.step2).toEqual({ status: 'success', output: { result: 'success' } });
      });

      it('should provide access to step results and trigger data via getStepResult helper', async () => {
        type TestTriggerSchema = z.ZodObject<{ inputValue: z.ZodString }>;

        const step1Action = vi.fn().mockImplementation(async ({ inputData }) => {
          // Test accessing trigger data with correct type
          expect(inputData).toEqual({ inputValue: 'test-input' });
          return { value: 'step1-result' };
        });

        const step2Action = vi.fn().mockImplementation(async ({ getStepResult }) => {
          // Test accessing previous step result with type
          const step1Result = getStepResult(step1);
          expect(step1Result).toEqual({ value: 'step1-result' });

          const failedStep = getStepResult(nonExecutedStep);
          expect(failedStep).toBe(null);

          return { value: 'step2-result' };
        });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        const nonExecutedStep = createStep({
          id: 'non-executed-step',
          execute: vi.fn(),
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const run = workflow.createRun();
        const result = await run.start({ inputData: { inputValue: 'test-input' } });

        expect(step1Action).toHaveBeenCalled();
        expect(step2Action).toHaveBeenCalled();
        expect(result.steps).toEqual({
          input: { inputValue: 'test-input' },
          step1: { status: 'success', output: { value: 'step1-result' } },
          step2: { status: 'success', output: { value: 'step2-result' } },
        });
      });

      it('should resolve trigger data from context', async () => {
        const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          inputData: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).commit();

        const run = workflow.createRun();
        const result = await run.start({ inputData: { inputData: 'test-input' } });

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { inputData: 'test-input' },
          }),
        );
      });

      it('should resolve variables from previous steps', async () => {
        const step1Action = vi.fn<any>().mockResolvedValue({
          nested: { value: 'step1-data' },
        });
        const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success' });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ previousValue: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow
          .then(step1)
          .map({
            previousValue: {
              step: step1,
              path: 'nested.value',
            },
          })
          .then(step2)
          .commit();

        const run = workflow.createRun();
        const result = await run.start({ inputData: {} });

        expect(step2Action).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: {
              previousValue: 'step1-data',
            },
          }),
        );
      });
    });

    describe('Simple Conditions', () => {
      it('should follow conditional chains', async () => {
        const step1Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ status: 'success' });
        });
        const step2Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ result: 'step2' });
        });
        const step3Action = vi.fn().mockImplementation(() => {
          return Promise.resolve({ result: 'step3' });
        });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ status: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step3 = createStep({
          id: 'step3',
          execute: step3Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
          steps: [step1, step2, step3],
        });

        workflow
          .then(step1)
          .branch([
            [
              async ({ inputData }) => {
                return inputData.status === 'success';
              },
              step2,
            ],
            [
              async ({ inputData }) => {
                return inputData.status === 'failed';
              },
              step3,
            ],
          ])
          .commit();

        const run = workflow.createRun();
        const result = await run.start({ inputData: { status: 'success' } });

        expect(step1Action).toHaveBeenCalled();
        expect(step2Action).toHaveBeenCalled();
        expect(step3Action).not.toHaveBeenCalled();
        expect(result.steps).toEqual({
          input: { status: 'success' },
          step1: { status: 'success', output: { status: 'success' } },
          step2: { status: 'success', output: { result: 'step2' } },
        });
      });

      it('should handle failing dependencies', async () => {
        const step1Action = vi.fn<any>().mockRejectedValue(new Error('Failed'));
        const step2Action = vi.fn<any>();

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          steps: [step1, step2],
        });

        workflow.then(step1).then(step2).commit();

        const run = workflow.createRun();
        let result: Awaited<ReturnType<typeof run.start>> | undefined = undefined;
        try {
          result = await run.start({ inputData: {} });
        } catch {
          // do nothing
        }

        expect(step1Action).toHaveBeenCalled();
        expect(step2Action).not.toHaveBeenCalled();
        expect(result?.steps).toEqual({
          input: {},
          step1: { status: 'failed', error: 'Failed' },
        });
      });

      it('should support simple string conditions', async () => {
        const step1Action = vi.fn<any>().mockResolvedValue({ status: 'success' });
        const step2Action = vi.fn<any>().mockResolvedValue({ result: 'step2' });
        const step3Action = vi.fn<any>().mockResolvedValue({ result: 'step3' });
        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({ status: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ status: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step3 = createStep({
          id: 'step3',
          execute: step3Action,
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          steps: [step1, step2, step3],
        });
        workflow
          .then(step1)
          .branch([
            [
              async ({ inputData }) => {
                return inputData.status === 'success';
              },
              step2,
            ],
          ])
          .map({
            result: {
              step: step3,
              path: 'result',
            },
          })
          .branch([
            [
              async ({ inputData }) => {
                return inputData.result === 'unexpected value';
              },
              step3,
            ],
          ])
          .commit();

        const run = workflow.createRun();
        const result = await run.start({ inputData: { status: 'success' } });

        expect(step1Action).toHaveBeenCalled();
        expect(step2Action).toHaveBeenCalled();
        expect(step3Action).not.toHaveBeenCalled();
        expect(result.steps).toMatchObject({
          input: { status: 'success' },
          step1: { status: 'success', output: { status: 'success' } },
          step2: { status: 'success', output: { result: 'step2' } },
        });
      });

      it('should support custom condition functions', async () => {
        const step1Action = vi.fn<any>().mockResolvedValue({ count: 5 });
        const step2Action = vi.fn<any>();

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({ count: z.number() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ count: z.number() }),
          outputSchema: z.object({}),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });

        workflow
          .then(step1)
          .branch([
            [
              async ({ getStepResult }) => {
                const step1Result = getStepResult(step1);

                return step1Result ? step1Result.count > 3 : false;
              },
              step2,
            ],
          ])
          .commit();

        const run = workflow.createRun();
        const result = await run.start({ inputData: { count: 5 } });

        expect(step2Action).toHaveBeenCalled();
        expect(result.steps.step1).toEqual({
          status: 'success',
          output: { count: 5 },
        });
        expect(result.steps.step2).toEqual({
          status: 'success',
          output: undefined,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      const error = new Error('Step execution failed');
      const failingAction = vi.fn<any>().mockRejectedValue(error);

      const step1 = createStep({
        id: 'step1',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow.then(step1).commit();

      const run = workflow.createRun();

      await expect(run.start({ inputData: {} })).resolves.toMatchObject({
        steps: {
          step1: {
            error: 'Step execution failed',
            status: 'failed',
          },
        },
      });
    });

    it('should handle variable resolution errors', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ data: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ data: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>(),
        inputSchema: z.object({ data: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow
        .then(step1)
        .map({
          data: { step: step1, path: 'data' },
        })
        .then(step2)
        .commit();

      const run = workflow.createRun();
      await expect(run.start({ inputData: {} })).resolves.toMatchObject({
        steps: {
          step1: {
            status: 'success',
            output: {
              data: 'success',
            },
          },
          step2: {
            output: undefined,
            status: 'success',
          },
        },
      });
    });
  });

  describe('Complex Conditions', () => {
    it('should handle nested AND/OR conditions', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({
        status: 'partial',
        score: 75,
        flags: { isValid: true },
      });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'step3' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({
          status: z.string(),
          score: z.number(),
          flags: z.object({ isValid: z.boolean() }),
        }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({
          status: z.string(),
          score: z.number(),
          flags: z.object({ isValid: z.boolean() }),
        }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({
          result: z.string(),
        }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow
        .then(step1)
        .branch([
          [
            async ({ getStepResult }) => {
              const step1Result = getStepResult(step1);
              return (
                step1Result?.status === 'success' || (step1Result?.status === 'partial' && step1Result?.score >= 70)
              );
            },
            step2,
          ],
        ])
        .map({
          result: {
            step: step2,
            path: 'result',
          },
        })
        .branch([
          [
            async ({ inputData, getStepResult }) => {
              const step1Result = getStepResult(step1);
              return !inputData.result || step1Result?.score < 70;
            },
            step3,
          ],
        ])
        .map({
          result: {
            step: step3,
            path: 'result',
          },
        })
        .commit();

      const run = workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.steps.step2).toEqual({ status: 'success', output: { result: 'step2' } });
    });
  });

  describe('Loops', () => {
    it('should run an until loop', async () => {
      const increment = vi.fn().mockImplementation(async ({ inputData, getStepResult }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.value;

        // Increment the value
        const newValue = currentValue + 1;

        return { value: newValue };
      });
      const incrementStep = createStep({
        id: 'increment',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          value: z.number(),
          target: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: increment,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        return { finalValue: inputData?.value };
      });
      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        steps: [incrementStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.object({
          target: z.number(),
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
      });

      counterWorkflow
        .dountil(incrementStep, async ({ inputData }) => {
          return (inputData?.value ?? 0) >= 12;
        })
        .then(finalStep)
        .commit();

      const run = counterWorkflow.createRun();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.result).toEqual({ finalValue: 12 });
      // @ts-ignore
      expect(result.steps.increment.output).toEqual({ value: 12 });
    });

    it('should run a while loop', async () => {
      const increment = vi.fn().mockImplementation(async ({ inputData, getStepResult }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.value;

        // Increment the value
        const newValue = currentValue + 1;

        return { value: newValue };
      });
      const incrementStep = createStep({
        id: 'increment',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          value: z.number(),
          target: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: increment,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        return { finalValue: inputData?.value };
      });
      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        steps: [incrementStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.object({
          target: z.number(),
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
      });

      counterWorkflow
        .dowhile(incrementStep, async ({ inputData }) => {
          return (inputData?.value ?? 0) < 12;
        })
        .then(finalStep)
        .commit();

      const run = counterWorkflow.createRun();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.result).toEqual({ finalValue: 12 });
      // @ts-ignore
      expect(result.steps.increment.output).toEqual({ value: 12 });
    });
  });

  describe('if-else branching', () => {
    it('should run the if-then branch', async () => {
      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)

        // Increment the value
        const newValue = (inputData?.startValue ?? 0) + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        description: 'Other step',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          other: z.number(),
        }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const finalIf = createStep({
        id: 'finalIf',
        description: 'Final step that prints the result',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });
      const finalElse = createStep({
        id: 'finalElse',
        description: 'Final step that prints the result',
        inputSchema: z.object({ other: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        steps: [startStep, finalIf],
      });

      const elseBranch = createWorkflow({
        id: 'else-branch',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        steps: [otherStep, finalElse],
      })
        .then(otherStep)
        .then(finalElse)
        .commit();

      counterWorkflow
        .then(startStep)
        .branch([
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return !current || current < 5;
            },
            finalIf,
          ],
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return current >= 5;
            },
            elseBranch,
          ],
        ])
        .commit();

      const run = counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 1 } });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(0);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps.finalIf.output).toEqual({ finalValue: 2 });
      // @ts-ignore
      expect(result.steps.start.output).toEqual({ newValue: 2 });
    });

    // it('should run the else branch', async () => {
    //   const start = vi.fn().mockImplementation(async ({ context }) => {
    //     // Get the current value (either from trigger or previous increment)
    //     const currentValue =
    //       context.getStepResult('start')?.newValue || context.getStepResult('trigger')?.startValue || 0;

    //     // Increment the value
    //     const newValue = currentValue + 1;

    //     return { newValue };
    //   });
    //   const startStep = new Step({
    //     id: 'start',
    //     description: 'Increments the current value by 1',
    //     outputSchema: z.object({
    //       newValue: z.number(),
    //     }),
    //     execute: start,
    //   });

    //   const other = vi.fn().mockImplementation(async () => {
    //     return { other: 26 };
    //   });
    //   const otherStep = new Step({
    //     id: 'other',
    //     description: 'Other step',
    //     execute: other,
    //   });

    //   const final = vi.fn().mockImplementation(async ({ context }) => {
    //     const startVal = context.getStepResult('start')?.newValue ?? 0;
    //     const otherVal = context.getStepResult('other')?.other ?? 0;
    //     return { finalValue: startVal + otherVal };
    //   });
    //   const finalStep = new Step({
    //     id: 'final',
    //     description: 'Final step that prints the result',
    //     execute: final,
    //   });

    //   const counterWorkflow = new Workflow({
    //     name: 'counter-workflow',
    //     triggerSchema: z.object({
    //       startValue: z.number(),
    //     }),
    //   });

    //   counterWorkflow
    //     .step(startStep)
    //     .if(async ({ context }) => {
    //       const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    //       return !current || current < 5;
    //     })
    //     .then(finalStep)
    //     .else()
    //     .then(otherStep)
    //     .then(finalStep)
    //     .commit();

    //   const run = counterWorkflow.createRun();
    //   const { results } = await run.start({ triggerData: { startValue: 6 } });

    //   expect(start).toHaveBeenCalledTimes(1);
    //   expect(other).toHaveBeenCalledTimes(1);
    //   expect(final).toHaveBeenCalledTimes(1);
    //   // @ts-ignore
    //   expect(results.start.output).toEqual({ newValue: 7 });
    //   // @ts-ignore
    //   expect(results.other.output).toEqual({ other: 26 });

    //   // @ts-ignore
    //   expect(results.final.output).toEqual({ finalValue: 26 + 7 });
    // });

    // it('should run the else branch (when query)', async () => {
    //   const start = vi.fn().mockImplementation(async ({ context }) => {
    //     // Get the current value (either from trigger or previous increment)
    //     const currentValue =
    //       context.getStepResult('start')?.newValue || context.getStepResult('trigger')?.startValue || 0;

    //     // Increment the value
    //     const newValue = currentValue + 1;

    //     return { newValue };
    //   });
    //   const startStep = new Step({
    //     id: 'start',
    //     description: 'Increments the current value by 1',
    //     outputSchema: z.object({
    //       newValue: z.number(),
    //     }),
    //     execute: start,
    //   });

    //   const other = vi.fn().mockImplementation(async () => {
    //     return { other: 26 };
    //   });
    //   const otherStep = new Step({
    //     id: 'other',
    //     description: 'Other step',
    //     execute: other,
    //   });

    //   const final = vi.fn().mockImplementation(async ({ context }) => {
    //     const startVal = context.getStepResult('start')?.newValue ?? 0;
    //     const otherVal = context.getStepResult('other')?.other ?? 0;
    //     return { finalValue: startVal + otherVal };
    //   });
    //   const finalStep = new Step({
    //     id: 'final',
    //     description: 'Final step that prints the result',
    //     execute: final,
    //   });

    //   const counterWorkflow = new Workflow({
    //     name: 'counter-workflow',
    //     triggerSchema: z.object({
    //       startValue: z.number(),
    //     }),
    //   });

    //   counterWorkflow
    //     .step(startStep)
    //     .if({
    //       ref: { step: startStep, path: 'newValue' },
    //       query: { $lt: 5 },
    //     })
    //     .then(finalStep)
    //     .else()
    //     .then(otherStep)
    //     .then(finalStep)
    //     .commit();

    //   const run = counterWorkflow.createRun();
    //   const { results } = await run.start({ triggerData: { startValue: 6 } });

    //   expect(start).toHaveBeenCalledTimes(1);
    //   expect(other).toHaveBeenCalledTimes(1);
    //   expect(final).toHaveBeenCalledTimes(1);
    //   // @ts-ignore
    //   expect(results.start.output).toEqual({ newValue: 7 });
    //   // @ts-ignore
    //   expect(results.other.output).toEqual({ other: 26 });

    //   // @ts-ignore
    //   expect(results.final.output).toEqual({ finalValue: 26 + 7 });
    // });

    // it('should run else-then and a nested if-then branch', async () => {
    //   const start = vi.fn().mockImplementation(async ({ context }) => {
    //     // Get the current value (either from trigger or previous increment)
    //     const currentValue =
    //       context.getStepResult('start')?.newValue || context.getStepResult('trigger')?.startValue || 0;

    //     // Increment the value
    //     const newValue = currentValue + 1;

    //     return { newValue };
    //   });
    //   const startStep = new Step({
    //     id: 'start',
    //     description: 'Increments the current value by 1',
    //     outputSchema: z.object({
    //       newValue: z.number(),
    //     }),
    //     execute: start,
    //   });

    //   const other = vi.fn().mockImplementation(async () => {
    //     return { other: 26 };
    //   });
    //   const otherStep = new Step({
    //     id: 'other',
    //     description: 'Other step',
    //     execute: other,
    //   });

    //   const final = vi.fn().mockImplementation(async ({ context }) => {
    //     const startVal = context.getStepResult('start')?.newValue ?? 0;
    //     const otherVal = context.getStepResult('other')?.other ?? 0;
    //     return { finalValue: startVal + otherVal };
    //   });
    //   const finalStep = new Step({
    //     id: 'final',
    //     description: 'Final step that prints the result',
    //     execute: final,
    //   });

    //   const counterWorkflow = new Workflow({
    //     name: 'counter-workflow',
    //     triggerSchema: z.object({
    //       startValue: z.number(),
    //     }),
    //   });

    //   counterWorkflow
    //     .step(startStep)
    //     .if(async ({ context }) => {
    //       const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    //       return !current || current > 5;
    //     })
    //     .then(finalStep)
    //     .else()
    //     .if(async ({ context }) => {
    //       const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    //       return current === 2;
    //     })
    //     .then(otherStep)
    //     .then(finalStep)
    //     .else()
    //     .then(finalStep)
    //     .commit();

    //   const run = counterWorkflow.createRun();
    //   const { results } = await run.start({ triggerData: { startValue: 1 } });

    //   expect(start).toHaveBeenCalledTimes(1);
    //   expect(other).toHaveBeenCalledTimes(1);
    //   expect(final).toHaveBeenCalledTimes(1);
    //   // @ts-ignore
    //   expect(results.start.output).toEqual({ newValue: 2 });
    //   // @ts-ignore
    //   expect(results.other.output).toEqual({ other: 26 });

    //   // @ts-ignore
    //   expect(results.final.output).toEqual({ finalValue: 26 + 2 });
    // });

    // it('should run if-then and a nested else-then branch', async () => {
    //   const start = vi.fn().mockImplementation(async ({ context }) => {
    //     // Get the current value (either from trigger or previous increment)
    //     const currentValue =
    //       context.getStepResult('start')?.newValue || context.getStepResult('trigger')?.startValue || 0;

    //     // Increment the value
    //     const newValue = currentValue + 1;

    //     return { newValue };
    //   });
    //   const startStep = new Step({
    //     id: 'start',
    //     description: 'Increments the current value by 1',
    //     outputSchema: z.object({
    //       newValue: z.number(),
    //     }),
    //     execute: start,
    //   });

    //   const other = vi.fn().mockImplementation(async () => {
    //     return { other: 26 };
    //   });
    //   const otherStep = new Step({
    //     id: 'other',
    //     description: 'Other step',
    //     execute: other,
    //   });

    //   const final = vi.fn().mockImplementation(async ({ context }) => {
    //     const startVal = context.getStepResult('start')?.newValue ?? 0;
    //     const otherVal = context.getStepResult('other')?.other ?? 0;
    //     return { finalValue: startVal + otherVal };
    //   });
    //   const finalStep = new Step({
    //     id: 'final',
    //     description: 'Final step that prints the result',
    //     execute: final,
    //   });

    //   const counterWorkflow = new Workflow({
    //     name: 'counter-workflow',
    //     triggerSchema: z.object({
    //       startValue: z.number(),
    //     }),
    //   });

    //   counterWorkflow
    //     .step(startStep)
    //     .if(async ({ context }) => {
    //       const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    //       return !current || current < 5;
    //     })
    //     .if(async ({ context }) => {
    //       const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    //       return current === 2;
    //     })
    //     .then(otherStep)
    //     .then(finalStep)
    //     .else()
    //     .then(finalStep)

    //     .else()
    //     .then(finalStep)
    //     .commit();

    //   const run = counterWorkflow.createRun();
    //   const { results } = await run.start({ triggerData: { startValue: 1 } });

    //   expect(start).toHaveBeenCalledTimes(1);
    //   expect(other).toHaveBeenCalledTimes(1);
    //   expect(final).toHaveBeenCalledTimes(1);
    //   // @ts-ignore
    //   expect(results.start.output).toEqual({ newValue: 2 });
    //   // @ts-ignore
    //   expect(results.other.output).toEqual({ other: 26 });

    //   // @ts-ignore
    //   expect(results.final.output).toEqual({ finalValue: 26 + 2 });
    // });

    // it('should run if-else in order', async () => {
    //   const order: string[] = [];

    //   const step1Action = vi.fn().mockImplementation(async () => {
    //     order.push('step1');
    //   });
    //   const step2Action = vi.fn().mockImplementation(async () => {
    //     order.push('step2');
    //   });
    //   const step3Action = vi.fn().mockImplementation(async () => {
    //     order.push('step3');
    //   });
    //   const step4Action = vi.fn().mockImplementation(async () => {
    //     order.push('step4');
    //   });
    //   const step5Action = vi.fn().mockImplementation(async () => {
    //     order.push('step5');
    //   });

    //   const step1 = new Step({ id: 'step1', execute: step1Action });
    //   const step2 = new Step({ id: 'step2', execute: step2Action });
    //   const step3 = new Step({ id: 'step3', execute: step3Action });
    //   const step4 = new Step({ id: 'step4', execute: step4Action });
    //   const step5 = new Step({ id: 'step5', execute: step5Action });

    //   const workflow = new Workflow({ name: 'test-workflow' });
    //   workflow
    //     .step(step1)
    //     .if(async () => true)
    //     .then(step2)
    //     .if(async () => false)
    //     .then(step3)
    //     .else()
    //     .then(step4)
    //     .else()
    //     .then(step5)
    //     .commit();

    //   const run = workflow.createRun();
    //   await run.start();

    //   expect(step1Action).toHaveBeenCalledTimes(1);
    //   expect(step2Action).toHaveBeenCalledTimes(1);
    //   expect(step3Action).not.toHaveBeenCalled();
    //   expect(step4Action).toHaveBeenCalledTimes(1);
    //   expect(step5Action).not.toHaveBeenCalled();
    //   expect(order).toEqual(['step1', 'step2', 'step4']);
    // });

    // it('should run stacked if-else in order', async () => {
    //   const order: string[] = [];

    //   const step1Action = vi.fn().mockImplementation(async () => {
    //     order.push('step1');
    //   });
    //   const step2Action = vi.fn().mockImplementation(async () => {
    //     order.push('step2');
    //   });
    //   const step3Action = vi.fn().mockImplementation(async () => {
    //     order.push('step3');
    //   });
    //   const step4Action = vi.fn().mockImplementation(async () => {
    //     order.push('step4');
    //   });
    //   const step5Action = vi.fn().mockImplementation(async () => {
    //     order.push('step5');
    //   });

    //   const step1 = new Step({ id: 'step1', execute: step1Action });
    //   const step2 = new Step({ id: 'step2', execute: step2Action });
    //   const step3 = new Step({ id: 'step3', execute: step3Action });
    //   const step4 = new Step({ id: 'step4', execute: step4Action });
    //   const step5 = new Step({ id: 'step5', execute: step5Action });

    //   const workflow = new Workflow({ name: 'test-workflow' });
    //   workflow
    //     .step(step1)
    //     .if(async () => true)
    //     .then(step2)
    //     .else()
    //     .then(step4)
    //     .if(async () => false)
    //     .then(step3)
    //     .else()
    //     .then(step5)
    //     .commit();

    //   const run = workflow.createRun();
    //   await run.start();

    //   expect(step1Action).toHaveBeenCalledTimes(1);
    //   expect(step2Action).toHaveBeenCalledTimes(1);
    //   expect(step3Action).not.toHaveBeenCalled();
    //   expect(step4Action).not.toHaveBeenCalled();
    //   expect(step5Action).toHaveBeenCalledTimes(1);
    //   expect(order).toEqual(['step1', 'step2', 'step5']);
    // });

    // it('should run an until loop inside an if-then branch', async () => {
    //   const increment = vi.fn().mockImplementation(async ({ context }) => {
    //     // Get the current value (either from trigger or previous increment)
    //     const currentValue =
    //       context.getStepResult('increment')?.newValue || context.getStepResult('trigger')?.startValue || 0;

    //     // Increment the value
    //     const newValue = currentValue + 1;

    //     return { newValue };
    //   });
    //   const other = vi.fn().mockImplementation(async () => {
    //     return { other: 26 };
    //   });
    //   const incrementStep = new Step({
    //     id: 'increment',
    //     description: 'Increments the current value by 1',
    //     outputSchema: z.object({
    //       newValue: z.number(),
    //     }),
    //     execute: increment,
    //   });

    //   const otherStep = new Step({
    //     id: 'other',
    //     description: 'Other step',
    //     execute: other,
    //   });

    //   const final = vi
    //     .fn()
    //     .mockImplementation(
    //       async ({ context }: { context: WorkflowContext<any, [typeof incrementStep, typeof finalStep]> }) => {
    //         return { finalValue: context.getStepResult(incrementStep).newValue };
    //       },
    //     );
    //   const finalStep = new Step({
    //     id: 'final',
    //     description: 'Final step that prints the result',
    //     execute: final,
    //   });

    //   const counterWorkflow = new Workflow<[typeof incrementStep, typeof finalStep]>({
    //     name: 'counter-workflow',
    //     triggerSchema: z.object({
    //       target: z.number(),
    //       startValue: z.number(),
    //     }),
    //   });

    //   counterWorkflow
    //     .step(incrementStep)
    //     .if(async () => {
    //       return false;
    //     })
    //     .then(incrementStep)
    //     .until(async ({ context }) => {
    //       const res = context.getStepResult('increment');
    //       return (res?.newValue ?? 0) >= 12;
    //     }, incrementStep)
    //     .then(finalStep)
    //     .else()
    //     .then(otherStep)
    //     .then(finalStep)
    //     .commit();

    //   const run = counterWorkflow.createRun();
    //   const { results } = await run.start({ triggerData: { target: 10, startValue: 0 } });

    //   expect(increment).toHaveBeenCalledTimes(1);
    //   expect(other).toHaveBeenCalledTimes(1);
    //   expect(final).toHaveBeenCalledTimes(1);
    //   // @ts-ignore
    //   expect(results.final.output).toEqual({ finalValue: 1 });
    //   // @ts-ignore
    //   expect(results.increment.output).toEqual({ newValue: 1 });
    // });
  });
});
