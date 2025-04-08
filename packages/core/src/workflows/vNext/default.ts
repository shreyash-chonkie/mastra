import type EventEmitter from 'events';
import type { ExecutionGraph } from './execution-engine';
import { ExecutionEngine } from './execution-engine';
import type { NewStep } from './step';
import type { StepResult } from './types';
import type { StepFlowEntry } from './workflow';

type ExecutionContext = {
  executionPath: number[];
  suspendedPaths: Record<string, number[]>;
};

/**
 * Default implementation of the ExecutionEngine using XState
 */
export class DefaultExecutionEngine extends ExecutionEngine {
  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async execute<TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    graph: ExecutionGraph;
    input?: TInput;
    resume?: {
      // TODO: add execute path
      steps: NewStep<string, any, any>[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    emitter: EventEmitter;
  }): Promise<TOutput> {
    const { workflowId, runId, graph, input, resume } = params;
    const steps = graph.steps;

    if (steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    await this.storage.init();

    let startIdx = 0;
    if (resume?.resumePath) {
      startIdx = resume.resumePath[0]!;
      resume.resumePath.shift();
    }

    const stepResults: Record<string, any> = resume?.stepResults || { input };
    let lastOutput: any;
    for (let i = startIdx; i < steps.length; i++) {
      const entry = steps[i]!;
      try {
        lastOutput = await this.executeEntry({
          workflowId,
          runId,
          entry,
          prevStep: steps[i - 1]!,
          stepResults,
          resume,
          executionContext: {
            executionPath: [i],
            suspendedPaths: {},
          },
          emitter: params.emitter,
        });
        if (lastOutput.status !== 'success') {
          if (entry.type === 'step') {
            params.emitter.emit('watch', {
              type: 'watch',
              payload: {
                currentStep: {
                  id: entry.step.id,
                  ...lastOutput,
                },
                workflowState: {
                  status: lastOutput.status,
                  steps: stepResults,
                  result: null,
                  error: lastOutput.error,
                },
              },
            });
          }
          return {
            steps: stepResults,
            result: null,
            error: lastOutput.error,
          } as TOutput;
        }
      } catch (e) {
        if (entry.type === 'step') {
          params.emitter.emit('watch', {
            type: 'watch',
            payload: {
              currentStep: {
                id: entry.step.id,
                ...lastOutput,
              },
              workflowState: {
                status: lastOutput.status,
                steps: stepResults,
                result: null,
                error: lastOutput.error,
              },
            },
          });
        }

        return {
          steps: stepResults,
          result: null,
          error: e instanceof Error ? e.message : 'Unknown error',
        } as TOutput;
      }
    }

    const res = { steps: stepResults, result: lastOutput.output };
    params.emitter.emit('watch', {
      type: 'watch',
      payload: {
        currentStep: {
          //@ts-ignore
          id: steps[steps.length - 1]!.step.id,
          ...lastOutput,
        },
        workflowState: {
          status: lastOutput.status,
          steps: stepResults,
          result: null,
          error: lastOutput.error,
        },
      },
    });

    return res as TOutput;
  }

  getStepOutput(stepResults: Record<string, any>, step?: StepFlowEntry): any {
    if (!step) {
      return stepResults.input;
    } else if (step.type === 'step') {
      return stepResults[step.step.id]?.output;
    } else if (step.type === 'parallel' || step.type === 'conditional') {
      return step.steps.reduce(
        (acc, entry) => {
          if (entry.type === 'step') {
            acc[entry.step.id] = stepResults[entry.step.id]?.output;
          } else if (entry.type === 'parallel') {
            const parallelResult = this.getStepOutput(stepResults, entry)?.output;
            acc = { ...acc, ...parallelResult };
          }
          return acc;
        },
        {} as Record<string, any>,
      );
    }
  }

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
  }: {
    step: NewStep<string, any, any>;
    stepResults: Record<string, StepResult<any>>;
    executionContext: ExecutionContext;
    resume?: {
      steps: NewStep<string, any, any>[];
      resumePayload: any;
    };
    prevOutput: any;
    emitter: EventEmitter;
  }): Promise<StepResult<any>> {
    let execResults: any;

    for (let i = 0; i < (step.retries ?? 1); i++) {
      try {
        let suspended: { payload: any } | undefined;
        const result = await step.execute({
          inputData: resume?.steps[0]!.id === step.id ? resume?.resumePayload : prevOutput,
          getStepResult: (step: any) => {
            const result = stepResults[step.id];
            if (result?.status === 'success') {
              return result.output;
            }

            return null;
          },
          suspend: async (suspendPayload: any) => {
            executionContext.suspendedPaths[step.id] = executionContext.executionPath;
            suspended = { payload: suspendPayload };
          },
          resume: {
            steps: resume?.steps?.slice(1) || [],
            resumePayload: resume?.resumePayload,
            // @ts-ignore
            runId: stepResults[step.id]?.payload?.__workflow_meta?.runId,
          },
          emitter,
        });

        if (suspended) {
          stepResults[step.id] = { status: 'suspended', payload: suspended.payload };
          execResults = { status: 'suspended', output: suspended.payload };
        } else {
          stepResults[step.id] = { status: 'success', output: result };
          execResults = { status: 'success', output: result };
        }

        break;
      } catch (e) {
        stepResults[step.id] = { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' };
        execResults = { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' };
      }
    }

    return execResults;
  }

  async executeEntry({
    workflowId,
    runId,
    entry,
    prevStep,
    stepResults,
    resume,
    executionContext,
    emitter,
  }: {
    workflowId: string;
    runId: string;
    entry: StepFlowEntry;
    prevStep: StepFlowEntry;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: NewStep<string, any, any>[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: EventEmitter;
  }): Promise<StepResult<any>> {
    const prevOutput = this.getStepOutput(stepResults, prevStep);
    let execResults: any;

    if (entry.type === 'step') {
      const { step } = entry;
      execResults = await this.executeStep({
        step,
        stepResults,
        executionContext,
        resume,
        prevOutput,
        emitter,
      });
    } else if (resume?.resumePath?.length) {
      const idx = resume.resumePath.pop();
      return this.executeEntry({
        workflowId,
        runId,
        entry: entry.steps[idx!]!,
        prevStep,
        stepResults,
        resume,
        executionContext: {
          executionPath: [...executionContext.executionPath, idx!],
          suspendedPaths: executionContext.suspendedPaths,
        },
        emitter,
      });
    } else if (entry.type === 'parallel') {
      const results: StepResult<any>[] = await Promise.all(
        entry.steps.map((step, i) =>
          this.executeEntry({
            workflowId,
            runId,
            entry: step,
            prevStep,
            stepResults,
            resume,
            executionContext: {
              executionPath: [...executionContext.executionPath, i],
              suspendedPaths: executionContext.suspendedPaths,
            },
            emitter,
          }),
        ),
      );
      const hasFailed = results.find(result => result.status === 'failed');
      const hasSuspended = results.find(result => result.status === 'suspended');
      if (hasFailed) {
        execResults = { status: 'failed', error: hasFailed.error };
      } else if (hasSuspended) {
        execResults = { status: 'suspended', output: hasSuspended.payload };
      } else {
        execResults = {
          status: 'success',
          output: results.reduce((acc: Record<string, any>, result) => {
            if (result.status === 'success') {
              Object.entries(result).forEach(([key, value]) => {
                if (value.status === 'success') {
                  acc[key] = value.output;
                }
              });
            }

            return acc;
          }, {}),
        };
      }
    } else if (entry.type === 'conditional') {
      const truthyIndexes = (
        await Promise.all(
          entry.conditions.map(async (cond, index) => {
            try {
              const result = await cond({
                inputData: prevOutput,
                getStepResult: (step: any) => {
                  const result = stepResults[step.id];
                  if (result?.status === 'success') {
                    return result.output;
                  }

                  return null;
                },

                // TODO: this function shouldn't have suspend probably?
                suspend: async (_suspendPayload: any) => {},
                emitter,
              });
              return result ? index : null;
            } catch (e: unknown) {
              return null;
            }
          }),
        )
      ).filter((index): index is number => index !== null);

      const stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));
      const results: StepResult<any>[] = await Promise.all(
        stepsToRun.map((step, index) =>
          this.executeEntry({
            workflowId,
            runId,
            entry: step,
            prevStep,
            stepResults,
            executionContext: {
              executionPath: [...executionContext.executionPath, index],
              suspendedPaths: executionContext.suspendedPaths,
            },
            emitter,
          }),
        ),
      );
      const hasFailed = results.find(result => result.status === 'failed');
      const hasSuspended = results.find(result => result.status === 'suspended');
      if (hasFailed) {
        execResults = { status: 'failed', error: hasFailed.error };
      } else if (hasSuspended) {
        execResults = { status: 'suspended', output: hasSuspended.payload };
      } else {
        execResults = {
          status: 'success',
          output: results.reduce((acc: Record<string, any>, result) => {
            if (result.status === 'success') {
              Object.entries(result).forEach(([key, value]) => {
                if (value.status === 'success') {
                  acc[key] = value.output;
                }
              });
            }

            return acc;
          }, {}),
        };
      }
    }

    await this.storage.persistWorkflowSnapshot({
      workflowName: workflowId,
      runId,
      snapshot: {
        runId,
        value: {},
        context: stepResults as any,
        activePaths: [],
        suspendedPaths: executionContext.suspendedPaths,
        // @ts-ignore
        timestamp: Date.now(),
      },
    });

    if (entry.type === 'step') {
      emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: entry.step.id,
            status: execResults.status,
            output: execResults.output,
          },
          workflowState: {
            status: 'running',
          },
        },
      });
    }
    return execResults;
  }
}
