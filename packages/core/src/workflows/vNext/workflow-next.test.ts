import { afterAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createStep, createWorkflow, NewWorkflow } from './workflow';
import path from 'path';
import fs from 'fs';

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

    it('should run the else branch', async () => {
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

      const other = vi.fn().mockImplementation(async ({ inputData }) => {
        return { newValue: inputData.newValue, other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        description: 'Other step',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          other: z.number(),
          newValue: z.number(),
        }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        const startVal = inputData?.newValue ?? 0;
        const otherVal = inputData?.other ?? 0;
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
        inputSchema: z.object({ other: z.number(), newValue: z.number() }),
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
      const result = await run.start({ inputData: { startValue: 6 } });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['else-branch'].output).toEqual({ finalValue: 26 + 6 + 1 });
      // @ts-ignore
      expect(result.steps.start.output).toEqual({ newValue: 7 });
    });
  });

  describe('multiple chains', () => {
    it('should run multiple chains in parallel', async () => {
      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success1' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success2' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step3 = createStep({
        id: 'step3',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success3' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step4 = createStep({
        id: 'step4',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success4' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step5 = createStep({
        id: 'step5',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success5' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2, step3, step4, step5],
      });
      workflow
        .parallel([
          createWorkflow({
            id: 'nested-a',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            steps: [step1, step2, step3],
          })
            .then(step1)
            .then(step2)
            .then(step3)
            .commit(),
          createWorkflow({
            id: 'nested-b',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            steps: [step4, step5],
          })
            .then(step4)
            .then(step5)
            .commit(),
        ])
        .commit();

      const run = workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps['nested-a']).toEqual({ status: 'success', output: { result: 'success3' } });
      expect(result.steps['nested-b']).toEqual({ status: 'success', output: { result: 'success5' } });
    });
  });

  // TODO:
  // describe('Retry', () => {
  //   it('should retry a step default 0 times', async () => {
  //     const step1 = new Step({ id: 'step1', execute: vi.fn<any>().mockResolvedValue({ result: 'success' }) });
  //     const step2 = new Step({ id: 'step2', execute: vi.fn<any>().mockRejectedValue(new Error('Step failed')) });

  //     const mastra = new Mastra({
  //       logger: createLogger({
  //         name: 'Workflow',
  //       }),
  //       storage,
  //     });

  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       mastra,
  //     });

  //     workflow.step(step1).then(step2).commit();

  //     const run = workflow.createRun();
  //     const result = await run.start();

  //     expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success' } });
  //     expect(result.results.step2).toEqual({ status: 'failed', error: 'Step failed' });
  //     expect(step1.execute).toHaveBeenCalledTimes(1);
  //     expect(step2.execute).toHaveBeenCalledTimes(1); // 0 retries + 1 initial call
  //   });

  //   it('should retry a step with a custom retry config', async () => {
  //     const step1 = new Step({ id: 'step1', execute: vi.fn<any>().mockResolvedValue({ result: 'success' }) });
  //     const step2 = new Step({ id: 'step2', execute: vi.fn<any>().mockRejectedValue(new Error('Step failed')) });

  //     const mastra = new Mastra({
  //       logger: createLogger({
  //         name: 'Workflow',
  //       }),
  //       storage,
  //     });

  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       mastra,
  //       retryConfig: { attempts: 5, delay: 200 },
  //     });

  //     workflow.step(step1).then(step2).commit();

  //     const run = workflow.createRun();
  //     const result = await run.start();

  //     expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success' } });
  //     expect(result.results.step2).toEqual({ status: 'failed', error: 'Step failed' });
  //     expect(step1.execute).toHaveBeenCalledTimes(1);
  //     expect(step2.execute).toHaveBeenCalledTimes(6); // 5 retries + 1 initial call
  //   });
  // });

  describe('Watch', () => {
    it('should watch workflow state changes and call onTransition', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
      });
      workflow.then(step1).then(step2).commit();

      const onTransition = vi.fn();

      const run = workflow.createRun();

      // Start watching the workflow
      run.watch(onTransition);
      run.watch(ev => {
        console.log('ev', ev);
      });

      const executionResult = await run.start({ inputData: {} });

      expect(onTransition).toHaveBeenCalledTimes(2);
      expect(onTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'watch',
          payload: {
            currentStep: expect.objectContaining({
              id: expect.any(String),
              status: expect.any(String),
              output: expect.any(Object),
            }),
            workflowState: expect.objectContaining({
              status: expect.any(String),
            }),
          },
          eventTimestamp: expect.any(Number),
        }),
      );

      // Verify execution completed successfully
      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success1' },
      });
      expect(executionResult.steps.step2).toEqual({
        status: 'success',
        output: { result: 'success2' },
      });
    });

    it('should unsubscribe from transitions when unwatch is called', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      const onTransition = vi.fn();
      const onTransition2 = vi.fn();

      const run = workflow.createRun();

      run.watch(onTransition);
      run.watch(onTransition2);

      await run.start({ inputData: {} });

      expect(onTransition).toHaveBeenCalledTimes(2);
      expect(onTransition2).toHaveBeenCalledTimes(2);

      const run2 = workflow.createRun();

      run2.watch(onTransition2);

      await run2.start({ inputData: {} });

      expect(onTransition).toHaveBeenCalledTimes(2);
      expect(onTransition2).toHaveBeenCalledTimes(4);

      const run3 = workflow.createRun();

      run3.watch(onTransition);

      await run3.start({ inputData: {} });

      expect(onTransition).toHaveBeenCalledTimes(4);
      expect(onTransition2).toHaveBeenCalledTimes(4);
    });
  });

  describe('Suspend and Resume', () => {
    afterAll(async () => {
      const pathToDb = path.join(process.cwd(), 'mastra.db');

      if (fs.existsSync(pathToDb)) {
        fs.rmSync(pathToDb);
      }
    });
    it('should return the correct runId', async () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [],
      });
      const run = workflow.createRun();
      const run2 = workflow.createRun({ runId: run.runId });

      expect(run.runId).toBeDefined();
      expect(run2.runId).toBeDefined();
      expect(run.runId).toBe(run2.runId);
    });
    it('should handle basic suspend and resume flow', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi.fn().mockResolvedValue({ improvedOutput: 'improved output' });
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: improveResponseAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        inputSchema: z.object({ improvedOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        steps: [getUserInput, promptAgent, evaluateTone, improveResponse, evaluateImproved],
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      // TODO: add this logic back
      // Create a new storage instance for initial run
      // const initialStorage = new DefaultStorage({
      //   config: {
      //     url: 'file::memory:',
      //   },
      // });
      // await initialStorage.init();

      // const mastra = new Mastra({
      //   logger,
      //   storage: initialStorage,
      //   workflows: { 'test-workflow': promptEvalWorkflow },
      // });

      // const wf = mastra.getWorkflow('test-workflow');
      const run = promptEvalWorkflow.createRun();

      // Create a promise to track when the workflow is ready to resume
      let resolveWorkflowSuspended: (value: unknown) => void;
      const workflowSuspended = new Promise(resolve => {
        resolveWorkflowSuspended = resolve;
      });

      run.watch(data => {
        console.log('data', data);
        const isPromptAgentSuspended =
          data?.payload?.currentStep?.id === 'promptAgent' && data?.payload?.currentStep?.status === 'suspended';
        if (isPromptAgentSuspended) {
          resolveWorkflowSuspended({ stepId: 'promptAgent', context: { userInput: 'test input for resumption' } });
        }
      });

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      // Wait for the workflow to be ready to resume
      const resumeData = await workflowSuspended;
      const resumeResult = await run.resume({ inputData: resumeData as any, step: promptAgent });

      if (!resumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(resumeResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
        improveResponse: { status: 'success', output: { improvedOutput: 'improved output' } },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
        },
      });
    });

    it('should handle parallel steps with conditional suspend', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockResolvedValue({ modelOutput: 'test output' });
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const humanInterventionAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend, inputData }) => {
          if (!inputData.humanPrompt) {
            await suspend();
          }
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'human intervention output' }));
      const explainResponseAction = vi.fn().mockResolvedValue({
        improvedOutput: 'explanation output',
      });

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const humanIntervention = createStep({
        id: 'humanIntervention',
        execute: humanInterventionAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any(), humanPrompt: z.string().optional() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const explainResponse = createStep({
        id: 'explainResponse',
        execute: explainResponseAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        steps: [getUserInput, promptAgent, evaluateTone, humanIntervention, explainResponse],
      });

      workflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .branch([
          [() => Promise.resolve(true), humanIntervention],
          [() => Promise.resolve(false), explainResponse],
        ])
        .commit();

      // TODO
      // const mastra = new Mastra({
      //   logger,
      //   workflows: { 'test-workflow': workflow },
      //   storage,
      // });

      // const wf = mastra.getWorkflow('test-workflow');
      const run = workflow.createRun();

      const started = run.start({ inputData: { input: 'test' } });

      const result = await new Promise<any>((resolve, reject) => {
        let hasResumed = false;
        run.watch(async data => {
          console.log('data', data);
          const suspended =
            data.payload?.currentStep?.id === 'humanIntervention' && data.payload?.currentStep?.status === 'suspended';
          if (suspended) {
            if (!hasResumed) {
              hasResumed = true;

              try {
                const resumed = await run.resume({
                  step: humanIntervention,
                  inputData: {
                    humanPrompt: 'What improvements would you suggest?',
                  },
                });

                resolve(resumed as any);
              } catch (error) {
                reject(error);
              }
            }
          }
        });
      });

      const initialResult = await started;
      console.dir({ initialResult }, { depth: null });

      expect(initialResult.steps.humanIntervention.status).toBe('suspended');
      expect(initialResult.steps.explainResponse).toBeUndefined();
      expect(humanInterventionAction).toHaveBeenCalledTimes(2);
      expect(explainResponseAction).not.toHaveBeenCalled();

      if (!result) {
        throw new Error('Resume failed to return a result');
      }

      expect(result.steps).toEqual({
        input: { input: 'test' },
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
        humanIntervention: { status: 'success', output: { improvedOutput: 'human intervention output' } },
      });
    });

    //   it('should handle complex workflow with multiple suspends', async () => {
    //     const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
    //     const promptAgentAction = vi.fn().mockResolvedValue({ modelOutput: 'test output' });

    //     const evaluateToneAction = vi.fn().mockResolvedValue({
    //       toneScore: { score: 0.8 },
    //       completenessScore: { score: 0.7 },
    //     });
    //     const improveResponseAction = vi
    //       .fn()
    //       .mockImplementationOnce(async ({ suspend }) => {
    //         await suspend();
    //       })
    //       .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
    //     const evaluateImprovedAction = vi.fn().mockResolvedValue({
    //       toneScore: { score: 0.9 },
    //       completenessScore: { score: 0.8 },
    //     });
    //     const humanInterventionAction = vi
    //       .fn()
    //       .mockImplementationOnce(async ({ suspend }) => {
    //         await suspend();
    //       })
    //       .mockImplementationOnce(() => ({ improvedOutput: 'human intervention output' }));
    //     const explainResponseAction = vi.fn().mockResolvedValue({
    //       improvedOutput: 'explanation output',
    //     });

    //     const getUserInput = new Step({
    //       id: 'getUserInput',
    //       execute: getUserInputAction,
    //       outputSchema: z.object({ userInput: z.string() }),
    //     });
    //     const promptAgent = new Step({
    //       id: 'promptAgent',
    //       execute: promptAgentAction,
    //       outputSchema: z.object({ modelOutput: z.string() }),
    //     });
    //     const evaluateTone = new Step({
    //       id: 'evaluateToneConsistency',
    //       execute: evaluateToneAction,
    //       outputSchema: z.object({
    //         toneScore: z.any(),
    //         completenessScore: z.any(),
    //       }),
    //     });
    //     const improveResponse = new Step({
    //       id: 'improveResponse',
    //       execute: improveResponseAction,
    //       outputSchema: z.object({ improvedOutput: z.string() }),
    //     });
    //     const evaluateImproved = new Step({
    //       id: 'evaluateImprovedResponse',
    //       execute: evaluateImprovedAction,
    //       outputSchema: z.object({
    //         toneScore: z.any(),
    //         completenessScore: z.any(),
    //       }),
    //     });
    //     const humanIntervention = new Step({
    //       id: 'humanIntervention',
    //       execute: humanInterventionAction,
    //       outputSchema: z.object({ improvedOutput: z.string() }),
    //     });
    //     const explainResponse = new Step({
    //       id: 'explainResponse',
    //       execute: explainResponseAction,
    //       outputSchema: z.object({ improvedOutput: z.string() }),
    //     });

    //     const workflow = new Workflow({
    //       name: 'test-workflow',
    //       triggerSchema: z.object({ input: z.string() }),
    //     });

    //     workflow
    //       .step(getUserInput)
    //       .then(promptAgent)
    //       .then(evaluateTone)
    //       .then(improveResponse)
    //       .then(evaluateImproved)
    //       .after(evaluateImproved)
    //       .step(humanIntervention, {
    //         id: 'humanIntervention',
    //         when: () => Promise.resolve(true),
    //       })
    //       .step(explainResponse, {
    //         id: 'explainResponse',
    //         when: () => Promise.resolve(false),
    //       })
    //       .commit();

    //     const mastra = new Mastra({
    //       logger,
    //       workflows: { 'test-workflow': workflow },
    //       storage,
    //     });

    //     const wf = mastra.getWorkflow('test-workflow');
    //     const run = wf.createRun();
    //     const started = run.start({ triggerData: { input: 'test' } });
    //     let improvedResponseResultPromise: Promise<WorkflowResumeResult<any> | undefined>;

    //     const result = await new Promise<WorkflowResumeResult<any>>((resolve, reject) => {
    //       let hasResumed = false;
    //       run.watch(async data => {
    //         const isHumanInterventionSuspended = data.activePaths.get('humanIntervention')?.status === 'suspended';
    //         const isImproveResponseSuspended = data.activePaths.get('improveResponse')?.status === 'suspended';

    //         if (isHumanInterventionSuspended) {
    //           const newCtx = {
    //             ...data.results,
    //             humanPrompt: 'What improvements would you suggest?',
    //           };
    //           if (!hasResumed) {
    //             hasResumed = true;

    //             try {
    //               const resumed = await run.resume({
    //                 stepId: 'humanIntervention',
    //                 context: newCtx,
    //               });
    //               resolve(resumed as any);
    //             } catch (error) {
    //               reject(error);
    //             }
    //           }
    //         } else if (isImproveResponseSuspended) {
    //           const resumed = run.resume({
    //             stepId: 'improveResponse',
    //             context: {
    //               ...data.results,
    //             },
    //           });
    //           improvedResponseResultPromise = resumed;
    //         }
    //       });
    //     });

    //     const initialResult = await started;

    //     // @ts-ignore
    //     const improvedResponseResult = await improvedResponseResultPromise;
    //     expect(initialResult?.results.improveResponse.status).toBe('suspended');

    //     expect(improvedResponseResult?.results.humanIntervention.status).toBe('suspended');
    //     expect(improvedResponseResult?.results.improveResponse.status).toBe('success');
    //     expect(improvedResponseResult?.results.evaluateImprovedResponse.status).toBe('success');
    //     expect(improvedResponseResult?.results.explainResponse.status).toBe('skipped');
    //     expect(humanInterventionAction).toHaveBeenCalledTimes(2);
    //     expect(explainResponseAction).not.toHaveBeenCalled();

    //     if (!result) {
    //       throw new Error('Resume failed to return a result');
    //     }

    //     expect(result.results).toEqual({
    //       getUserInput: { status: 'success', output: { userInput: 'test input' } },
    //       promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
    //       evaluateToneConsistency: {
    //         status: 'success',
    //         output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
    //       },
    //       improveResponse: { status: 'success', output: { improvedOutput: 'improved output' } },
    //       evaluateImprovedResponse: {
    //         status: 'success',
    //         output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
    //       },
    //       humanIntervention: { status: 'success', output: { improvedOutput: 'human intervention output' } },
    //       explainResponse: { status: 'skipped' },
    //     });
    //   });

    //   it('should handle basic suspend and resume flow with async await syntax', async () => {
    //     const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
    //     const promptAgentAction = vi
    //       .fn()
    //       .mockImplementationOnce(async ({ suspend }) => {
    //         await suspend({ testPayload: 'hello' });
    //         return undefined;
    //       })
    //       .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
    //     const evaluateToneAction = vi.fn().mockResolvedValue({
    //       toneScore: { score: 0.8 },
    //       completenessScore: { score: 0.7 },
    //     });
    //     const improveResponseAction = vi
    //       .fn()
    //       .mockImplementationOnce(async ({ suspend }) => {
    //         await suspend();
    //         return undefined;
    //       })
    //       .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
    //     const evaluateImprovedAction = vi.fn().mockResolvedValue({
    //       toneScore: { score: 0.9 },
    //       completenessScore: { score: 0.8 },
    //     });

    //     const getUserInput = new Step({
    //       id: 'getUserInput',
    //       execute: getUserInputAction,
    //       outputSchema: z.object({ userInput: z.string() }),
    //     });
    //     const promptAgent = new Step({
    //       id: 'promptAgent',
    //       execute: promptAgentAction,
    //       outputSchema: z.object({ modelOutput: z.string() }),
    //     });
    //     const evaluateTone = new Step({
    //       id: 'evaluateToneConsistency',
    //       execute: evaluateToneAction,
    //       outputSchema: z.object({
    //         toneScore: z.any(),
    //         completenessScore: z.any(),
    //       }),
    //     });
    //     const improveResponse = new Step({
    //       id: 'improveResponse',
    //       execute: improveResponseAction,
    //       outputSchema: z.object({ improvedOutput: z.string() }),
    //     });
    //     const evaluateImproved = new Step({
    //       id: 'evaluateImprovedResponse',
    //       execute: evaluateImprovedAction,
    //       outputSchema: z.object({
    //         toneScore: z.any(),
    //         completenessScore: z.any(),
    //       }),
    //     });

    //     const promptEvalWorkflow = new Workflow<
    //       [typeof getUserInput, typeof promptAgent, typeof evaluateTone, typeof improveResponse, typeof evaluateImproved]
    //     >({
    //       name: 'test-workflow',
    //       triggerSchema: z.object({ input: z.string() }),
    //     });

    //     promptEvalWorkflow
    //       .step(getUserInput)
    //       .then(promptAgent)
    //       .then(evaluateTone)
    //       .then(improveResponse)
    //       .then(evaluateImproved)
    //       .commit();

    //     const mastra = new Mastra({
    //       logger,
    //       workflows: { 'test-workflow': promptEvalWorkflow },
    //       storage,
    //     });

    //     const wf = mastra.getWorkflow('test-workflow');
    //     const run = wf.createRun();

    //     const initialResult = await run.start({ triggerData: { input: 'test' } });
    //     expect(initialResult.results.promptAgent.status).toBe('suspended');
    //     expect(promptAgentAction).toHaveBeenCalledTimes(1);
    //     expect(initialResult.activePaths.size).toBe(1);
    //     expect(initialResult.activePaths.get('promptAgent')?.status).toBe('suspended');
    //     expect(initialResult.activePaths.get('promptAgent')?.suspendPayload).toEqual({ testPayload: 'hello' });
    //     expect(initialResult.results).toEqual({
    //       getUserInput: { status: 'success', output: { userInput: 'test input' } },
    //       promptAgent: { status: 'suspended', suspendPayload: { testPayload: 'hello' } },
    //     });

    //     const newCtx = {
    //       userInput: 'test input for resumption',
    //     };

    //     expect(initialResult.results.promptAgent.status).toBe('suspended');
    //     expect(promptAgentAction).toHaveBeenCalledTimes(1);

    //     const firstResumeResult = await run.resume({ stepId: 'promptAgent', context: newCtx });

    //     if (!firstResumeResult) {
    //       throw new Error('Resume failed to return a result');
    //     }

    //     expect(firstResumeResult.activePaths.size).toBe(1);
    //     expect(firstResumeResult.activePaths.get('improveResponse')?.status).toBe('suspended');
    //     expect(firstResumeResult.results).toEqual({
    //       getUserInput: { status: 'success', output: { userInput: 'test input' } },
    //       promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
    //       evaluateToneConsistency: {
    //         status: 'success',
    //         output: {
    //           toneScore: { score: 0.8 },
    //           completenessScore: { score: 0.7 },
    //         },
    //       },
    //       improveResponse: { status: 'suspended' },
    //     });

    //     const secondResumeResult = await run.resume({ stepId: 'improveResponse', context: newCtx });
    //     if (!secondResumeResult) {
    //       throw new Error('Resume failed to return a result');
    //     }

    //     expect(secondResumeResult.results).toEqual({
    //       getUserInput: { status: 'success', output: { userInput: 'test input' } },
    //       promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
    //       evaluateToneConsistency: {
    //         status: 'success',
    //         output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
    //       },
    //       improveResponse: { status: 'success', output: { improvedOutput: 'improved output' } },
    //       evaluateImprovedResponse: {
    //         status: 'success',
    //         output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
    //       },
    //     });
    //   });

    //   it('should handle basic event based resume flow', async () => {
    //     const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
    //     const promptAgentAction = vi
    //       .fn()
    //       .mockImplementationOnce(async () => {
    //         return { test: 'yes' };
    //       })
    //       .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
    //     const getUserInput = new Step({
    //       id: 'getUserInput',
    //       execute: getUserInputAction,
    //       outputSchema: z.object({ userInput: z.string() }),
    //     });
    //     const promptAgent = new Step({
    //       id: 'promptAgent',
    //       execute: promptAgentAction,
    //       outputSchema: z.object({ modelOutput: z.string() }),
    //     });

    //     const promptEvalWorkflow = new Workflow({
    //       name: 'test-workflow',
    //       triggerSchema: z.object({ input: z.string() }),
    //       events: {
    //         testev: {
    //           schema: z.object({
    //             catName: z.string(),
    //           }),
    //         },
    //       },
    //     });

    //     promptEvalWorkflow.step(getUserInput).afterEvent('testev').step(promptAgent).commit();

    //     const mastra = new Mastra({
    //       logger,
    //       workflows: { 'test-workflow': promptEvalWorkflow },
    //     });

    //     const wf = mastra.getWorkflow('test-workflow');
    //     const run = wf.createRun({
    //       events: {
    //         testev: {
    //           schema: z.object({
    //             catName: z.string(),
    //           }),
    //         },
    //       },
    //     });

    //     const initialResult = await run.start({ triggerData: { input: 'test' } });
    //     expect(initialResult.activePaths.size).toBe(1);
    //     expect(initialResult.results).toEqual({
    //       getUserInput: { status: 'success', output: { userInput: 'test input' } },
    //       __testev_event: { status: 'suspended' },
    //     });
    //     expect(getUserInputAction).toHaveBeenCalledTimes(1);

    //     const firstResumeResult = await run.resumeWithEvent('testev', {
    //       catName: 'test input for resumption',
    //     });

    //     if (!firstResumeResult) {
    //       throw new Error('Resume failed to return a result');
    //     }

    //     expect(firstResumeResult.activePaths.size).toBe(1);
    //     expect(firstResumeResult.results).toEqual({
    //       getUserInput: { status: 'success', output: { userInput: 'test input' } },
    //       promptAgent: { status: 'success', output: { test: 'yes' } },
    //       __testev_event: {
    //         status: 'success',
    //         output: {
    //           executed: true,
    //           resumedEvent: {
    //             catName: 'test input for resumption',
    //           },
    //         },
    //       },
    //     });
    //   });
  });
});
