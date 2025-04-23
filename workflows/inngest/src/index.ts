import { NewWorkflow, type NewStep as Step, DefaultExecutionEngine } from '@mastra/core/workflows/vNext';
import type { NewStep, NewWorkflowConfig, StepFlowEntry, StepResult } from '@mastra/core/workflows/vNext';
import { Inngest } from 'inngest';
import { connect } from 'inngest/connect';
import EventEmitter from 'events';
import type { Mastra } from '@mastra/core';
import { createWorkflow as createWorkflowVNext } from '@mastra/core/workflows/vNext';
import type { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';

export { createStep } from '@mastra/core/workflows/vNext';

export class InngestWorkflow<
  TSteps extends NewStep<string, any, any>[] = NewStep<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  private functions: Map<string, ReturnType<Inngest['createFunction']>> = new Map();
  #mastra: Mastra;

  constructor(params: NewWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
    super(params);
    this.#mastra = params.mastra!;
  }

  private getStepFunction(entry: StepFlowEntry): [string, ReturnType<Inngest['createFunction']>][] {
    const engine = this.executionEngine as InngestExecutionEngine;
    if (entry.type === 'step' || entry.type === 'loop' || entry.type === 'foreach') {
      const fn = engine.inngest.createFunction(
        { id: `workflow.${this.id}.step.${entry.step.id}` },
        { event: `workflow.${this.id}.step.${entry.step.id}` },
        async ({ event, step: inngestStep }) => {
          const { prevOutput, stepResults, executionContext, resume } = event.data;

          return engine.executeStep({
            step: entry.step,
            stepResults,
            executionContext,
            resume,
            prevOutput,
            emitter: new EventEmitter(),
            container: new RuntimeContext(), // TODO
          });
        },
      );

      return [[entry.step.id, fn]];
    } else if (entry.type === 'parallel' || entry.type === 'conditional') {
      return entry.steps.flatMap(this.getStepFunction);
    }

    return [];
  }

  commit(): NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TOutput> {
    const fns = this.executionGraph.steps.flatMap(this.getStepFunction);
    const map = new Map(fns);
    this.functions = map;

    return super.commit();
  }

  getFunctions() {
    return this.functions;
  }
}

export function createWorkflow<
  TWorkflowId extends string = string,
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput extends z.ZodObject<any> = z.ZodObject<any>,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
>(params: NewWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
  return createWorkflowVNext<TWorkflowId, TInput, TOutput, TSteps>({
    ...params,
    executionEngine: new InngestExecutionEngine(params.mastra!),
  });
}

async function getRuns(eventId: string) {
  const response = await fetch(`http://127.0.0.1:8288/v1/events/${eventId}/runs`, {
    headers: {
      Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY}`,
    },
  });
  const json = await response.json();
  return (json as any).data;
}

async function getRunOutput(eventId: string) {
  let runs = await getRuns(eventId);
  while (runs?.[0]?.status !== 'Completed') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    runs = await getRuns(eventId);
    if (runs?.[0]?.status === 'Failed' || runs?.[0]?.status === 'Cancelled') {
      throw new Error(`Function run ${runs?.[0]?.status}`);
    }
  }
  return runs?.[0];
}

export class InngestExecutionEngine extends DefaultExecutionEngine {
  public inngest: Inngest;
  private functions: Map<string, ReturnType<Inngest['createFunction']>> = new Map();

  constructor(mastra: Mastra) {
    super({ mastra });
    this.inngest = new Inngest({
      id: 'mastra',
      // signingKey: process.env.INNGEST_SIGNING_KEY,
      baseUrl: 'http://127.0.0.1:8288',
    });
  }

  async superExecuteStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
    container,
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
    container: RuntimeContext;
  }): Promise<StepResult<any>> {
    return super.executeStep({
      step,
      stepResults,
      executionContext,
      resume,
      prevOutput,
      emitter,
      container,
    });
  }

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
    container,
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
    container: RuntimeContext;
  }): Promise<StepResult<any>> {
    try {
      // Send event to trigger the function
      const event = await this.inngest.send({
        name: `workflow.${executionContext.workflowId}.step.${step.id}`,
        data: {
          runId: executionContext.runId,
          prevOutput,
          stepResults,
          executionContext,
          resume,
        },
      });

      // Wait for the run to complete and get its output
      const run = await getRunOutput(event.ids?.[0]!);
      const result = run.output;

      return { status: 'success' as const, output: result };
    } catch (e) {
      return { status: 'failed' as const, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }
}
