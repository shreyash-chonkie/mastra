import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createStep, createWorkflow, NewWorkflow } from './workflow';
import { subscribe } from 'diagnostics_channel';

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
  });
});
