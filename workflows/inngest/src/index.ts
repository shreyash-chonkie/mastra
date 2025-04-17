import { NewWorkflow, type NewStep as Step, DefaultExecutionEngine } from '@mastra/core/workflows/vNext';
import type { NewWorkflowConfig, StepResult } from '@mastra/core/workflows/vNext';
import { Inngest } from 'inngest';
import { connect } from 'inngest/connect';
import EventEmitter from 'events';
import type { Mastra } from '@mastra/core';
import { createWorkflow as createWorkflowVNext } from '@mastra/core/workflows/vNext';

export { createStep } from '@mastra/core/workflows/vNext';

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
  private inngest: Inngest;
  private functions: Map<string, ReturnType<Inngest['createFunction']>> = new Map();

  constructor(mastra: Mastra) {
    super({ mastra });
    this.inngest = new Inngest({
      name: 'mastra',
      signingKey: process.env.INNGEST_SIGNING_KEY,
    });
  }

  private registerFunction(
    step: Step<string, any, any>,
    stepResults: Record<string, StepResult<any>>,
    executionContext: { executionPath: number[]; suspendedPaths: Record<string, number[]> },
  ) {
    if (this.functions.has(step.id)) return this.functions.get(step.id)!;

    const fn = this.inngest.createFunction(
      { id: step.id },
      { event: `step.${step.id}` },
      async ({ event, step: inngestStep }) => {
        const result = await step.execute({
          mastra: this.mastra!,
          inputData: event.data.inputData,
          getInitData: () => stepResults.input as any,
          getStepResult: (s: Step<string, any, any>) => {
            const result = stepResults[s.id];
            return result?.status === 'success' ? result.output : null;
          },
          suspend: async (suspendPayload: unknown) => {
            executionContext.suspendedPaths[step.id] = executionContext.executionPath;
            return inngestStep.sleep('1s', '');
          },
          resume: event.data.resume,
          emitter: event.data.emitter,
        });
        return result;
      },
    );

    // Register with Inngest
    connect({
      apps: [{ client: this.inngest, functions: [fn] }],
    });

    this.functions.set(step.id, fn);
    return fn;
  }

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
  }: {
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any>>;
    executionContext: { executionPath: number[]; suspendedPaths: Record<string, number[]> };
    resume?: {
      steps: Step<string, any, any>[];
      resumePayload: any;
    };
    prevOutput: any;
    emitter: EventEmitter;
  }): Promise<StepResult<any>> {
    try {
      // Register the function if not already registered
      this.registerFunction(step, stepResults, executionContext);

      // Send event to trigger the function
      const event = await this.inngest.send({
        name: `step.${step.id}`,
        data: {
          inputData: step.id === 'step1' ? stepResults.input : prevOutput,
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
