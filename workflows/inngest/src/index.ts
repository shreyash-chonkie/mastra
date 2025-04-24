import { NewWorkflow, type NewStep as Step, DefaultExecutionEngine, Run } from '@mastra/core/workflows/vNext';
import type {
  ExecuteFunction,
  ExecutionContext,
  ExecutionEngine,
  ExecutionGraph,
  NewStep,
  NewWorkflowConfig,
  StepFlowEntry,
  StepResult,
  WorkflowResult,
} from '@mastra/core/workflows/vNext';
import { Inngest, type BaseContext } from 'inngest';
import { serve as inngestServe } from 'inngest/hono';
import EventEmitter from 'events';
import type { Mastra } from '@mastra/core';
import type { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';
import { randomUUID } from 'crypto';

import { createStep } from '@mastra/core/workflows/vNext';

export function serve({ mastra, ingest }: { mastra: Mastra; ingest: Inngest }): ReturnType<typeof inngestServe> {
  const wfs = mastra.vnext_getWorkflows();
  const functions = Object.values(wfs).flatMap(wf => {
    if (wf instanceof InngestWorkflow) {
      return wf.getFunctions();
    }
    return [];
  });
  console.log('FUNCTIONS', functions);
  return inngestServe({
    client: ingest,
    functions,
  });
}

export class InngestRun<
  TSteps extends NewStep<string, any, any>[] = NewStep<string, any, any>[],
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
> extends Run<TSteps, TInput, TOutput> {
  private inngest: Inngest;

  constructor(
    params: {
      workflowId: string;
      runId: string;
      executionEngine: ExecutionEngine;
      executionGraph: ExecutionGraph;
      mastra?: Mastra;
      retryConfig?: {
        attempts?: number;
        delay?: number;
      };
    },
    inngest: Inngest,
  ) {
    super(params);
    this.inngest = inngest;
  }

  async getRuns(eventId: string) {
    const response = await fetch(`${this.inngest.apiBaseUrl}/v1/events/${eventId}/runs`, {
      headers: {
        Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY}`,
      },
    });
    const json = await response.json();
    return (json as any).data;
  }

  async getRunOutput(eventId: string) {
    let runs = await this.getRuns(eventId);
    while (runs?.[0]?.status !== 'Completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runs = await this.getRuns(eventId);
      if (runs?.[0]?.status === 'Failed' || runs?.[0]?.status === 'Cancelled') {
        throw new Error(`Function run ${runs?.[0]?.status}`);
      }
    }
    return runs?.[0];
  }

  async start({
    inputData,
    runtimeContext,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        inputData,
        runId: this.runId,
      },
    });
    console.log('SENT EVENT', eventOutput);

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    console.dir({ runOutput }, { depth: null });
    const result = runOutput?.output;
    if (result.status === 'failed') {
      result.error = new Error(result.error);
    }
    return result;
  }
}

export class InngestWorkflow<
  TSteps extends NewStep<string, any, any>[] = NewStep<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  #mastra: Mastra;
  inngest: Inngest;

  private function: ReturnType<Inngest['createFunction']> | undefined;

  constructor(params: NewWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>, inngest: Inngest) {
    super(params);
    this.#mastra = params.mastra!;
    this.inngest = inngest;
  }

  createRun(options?: { runId?: string }): Run<TSteps, TInput, TOutput> {
    const runIdToUse = options?.runId || randomUUID();
    console.log('CREATING RUN', this.id, runIdToUse);

    // Return a new Run instance with object parameters
    return new InngestRun(
      {
        workflowId: this.id,
        runId: runIdToUse,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        mastra: this.#mastra,
        retryConfig: this.retryConfig,
      },
      this.inngest,
    );
  }

  getFunction() {
    if (this.function) {
      return this.function;
    }
    this.function = this.inngest.createFunction(
      // @ts-ignore
      { id: `workflow.${this.id}`, retries: this.retryConfig?.attempts ?? 0 },
      { event: `workflow.${this.id}` },
      async ({ event, step, attempt }) => {
        const { inputData, runId } = event.data;
        console.log('RUNNING FUNCTION', this.id, runId, inputData, attempt);

        const engine = new InngestExecutionEngine(this.#mastra, step, attempt);
        const result = await engine.execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
          workflowId: this.id,
          runId,
          graph: this.executionGraph,
          input: inputData,
          emitter: new EventEmitter(), // TODO
          retryConfig: this.retryConfig,
          runtimeContext: new RuntimeContext(), // TODO
        });

        return result;
      },
    );
    return this.function;
  }

  getNestedFunctions(steps: StepFlowEntry[]): ReturnType<Inngest['createFunction']>[] {
    return steps.flatMap(step => {
      if (step.type === 'step' || step.type === 'loop' || step.type === 'foreach') {
        if (step.step instanceof InngestWorkflow) {
          return [step.step.getFunction(), ...step.step.getNestedFunctions(step.step.executionGraph.steps)];
        }
        return [];
      } else if (step.type === 'parallel' || step.type === 'conditional') {
        return this.getNestedFunctions(step.steps);
      }

      return [];
    });
  }

  getFunctions() {
    return [this.getFunction(), ...this.getNestedFunctions(this.executionGraph.steps)];
  }
}

export function init(inngest: Inngest) {
  return {
    createWorkflow<
      TWorkflowId extends string = string,
      TInput extends z.ZodType<any> = z.ZodType<any>,
      TOutput extends z.ZodType<any> = z.ZodType<any>,
      TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
    >(params: NewWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
      return new InngestWorkflow(params, inngest);
    },
    createStep,
  };
}

export class InngestExecutionEngine extends DefaultExecutionEngine {
  private inngestStep: BaseContext<Inngest>['step'];
  private inngestAttempts: number;

  constructor(mastra: Mastra, inngestStep: BaseContext<Inngest>['step'], inngestAttempts: number = 0) {
    super({ mastra });
    this.inngestStep = inngestStep;
    this.inngestAttempts = inngestAttempts;
  }

  protected fmtReturnValue<TOutput>(
    stepResults: Record<string, StepResult<any>>,
    lastOutput: StepResult<any>,
    error?: Error | string,
  ): TOutput {
    const base: any = {
      status: lastOutput.status,
      steps: stepResults,
    };
    if (lastOutput.status === 'success') {
      base.result = lastOutput.output;
    } else if (lastOutput.status === 'failed') {
      base.error =
        error instanceof Error
          ? (error?.stack ?? error.message)
          : lastOutput?.error instanceof Error
            ? lastOutput.error.message
            : (lastOutput.error ?? error ?? 'Unknown error');
    } else if (lastOutput.status === 'suspended') {
      const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.payload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      });
      base.suspended = suspendedStepIds;
    }

    return base as TOutput;
  }

  async superExecuteStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
    runtimeContext,
  }: {
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any>>;
    executionContext: {
      workflowId: string;
      runId: string;
      executionPath: number[];
      suspendedPaths: Record<string, number[]>;
      retryConfig: { attempts: number; delay: number };
    };
    resume?: {
      steps: string[];
      resumePayload: any;
    };
    prevOutput: any;
    emitter: EventEmitter;
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
    return super.executeStep({
      step,
      stepResults,
      executionContext,
      resume,
      prevOutput,
      emitter,
      runtimeContext,
    });
  }

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
    runtimeContext,
  }: {
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any>>;
    executionContext: {
      workflowId: string;
      runId: string;
      executionPath: number[];
      suspendedPaths: Record<string, number[]>;
      retryConfig: { attempts: number; delay: number };
    };
    resume?: {
      steps: string[];
      resumePayload: any;
    };
    prevOutput: any;
    emitter: EventEmitter;
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
    if (step instanceof InngestWorkflow) {
      console.log('NESTED WORKFLOW', step.id);
      const run = step.createRun();
      const result = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
        function: step.getFunction(),
        data: {
          inputData: prevOutput,
          runId: run.runId,
        },
      })) as any;
      console.log('NESTED WORKFLOW RESULT', step.id, result);

      if (result.status === 'success') {
        return { status: 'success', output: result?.result };
      } else if (result.status === 'failed') {
        return { status: 'failed', error: result?.error };
      } else if (result.status === 'suspended') {
        return { status: 'suspended', payload: result?.payload };
      }
    }

    console.log('EXECUTING STEP', step.id);
    return this.inngestStep.run(`workflow.${executionContext.workflowId}.step.${step.id}`, async () => {
      const result = await super.executeStep({
        step,
        stepResults,
        executionContext,
        resume,
        prevOutput,
        emitter,
        runtimeContext,
      });

      if (result.status === 'failed') {
        if (executionContext.retryConfig.attempts > 0 && this.inngestAttempts < executionContext.retryConfig.attempts) {
          throw result.error;
        }

        return {
          status: result.status,
          error: result?.error instanceof Error ? result?.error?.message : result?.error,
        };
      }

      return result;
    });
  }

  async executeConditional({
    workflowId,
    runId,
    entry,
    prevOutput,
    prevStep,
    stepResults,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    entry: { type: 'conditional'; steps: StepFlowEntry[]; conditions: ExecuteFunction<any, any, any, any>[] };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: EventEmitter;
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
    let execResults: any;
    const truthyIndexes = (
      await Promise.all(
        entry.conditions.map((cond, index) =>
          this.inngestStep.run(`workflow.${workflowId}.conditional.${index}`, async () => {
            try {
              const result = await cond({
                mastra: this.mastra!,
                runtimeContext,
                inputData: prevOutput,
                getInitData: () => stepResults?.input as any,
                getStepResult: (step: any) => {
                  if (!step?.id) {
                    return null;
                  }

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
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e: unknown) {
              return null;
            }
          }),
        ),
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
          resume,
          executionContext: {
            workflowId,
            runId,
            executionPath: [...executionContext.executionPath, index],
            suspendedPaths: executionContext.suspendedPaths,
            retryConfig: executionContext.retryConfig,
          },
          emitter,
          runtimeContext,
        }),
      ),
    );
    const hasFailed = results.find(result => result.status === 'failed');
    const hasSuspended = results.find(result => result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.error };
    } else if (hasSuspended) {
      execResults = { status: 'suspended', payload: hasSuspended.payload };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.status === 'success') {
            // @ts-ignore
            acc[stepsToRun[index]!.step.id] = result.output;
          }

          return acc;
        }, {}),
      };
    }

    return execResults;
  }
}
