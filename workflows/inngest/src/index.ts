import { NewWorkflow, ExecutionEngine, type NewStep as Step } from '@mastra/core/workflows/vNext';
import type { ExecutionGraph, NewWorkflowConfig, StepFlowEntry } from '@mastra/core/workflows/vNext';
import { Inngest } from 'inngest';
import { connect } from 'inngest/connect';
import { z } from 'zod';

type InngestContext = {
  step: any; // Using any for now as Inngest types are not fully compatible
  event: Record<string, any>;
};

type InngestStepConfig = {
  id: string;
  name: string;
  handler: (ctx: InngestContext) => Promise<any>;
};

async function getRuns(eventId: string) {
  const response = await fetch(`http://localhost:8288/v1/events/${eventId}/runs`, {
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
    console.log(runs);
    if (runs?.[0]?.status === 'Failed' || runs?.[0]?.status === 'Cancelled') {
      throw new Error(`Function run ${runs?.[0]?.status}`);
    }
  }
  return runs?.[0];
}

class InngestExecutionEngine extends ExecutionEngine {
  private inngest: Inngest;
  private stepResults: Record<string, any> = {};

  constructor(inngest: Inngest) {
    super();
    this.inngest = inngest;
  }

  private transformStepToInngest(entry: StepFlowEntry, parentSteps: StepFlowEntry[]): InngestStepConfig[] {
    if (entry.type === 'step') {
      const { step } = entry;
      return [
        {
          id: step.id,
          name: step.description || step.id,
          handler: async ({ step: inngestStep, event }) => {
            // Get input data from previous step or initial input
            let inputData = this.stepResults['input'];

            // Find the previous step in the workflow
            const stepIndex = parentSteps.findIndex(s => s.type === 'step' && s.step.id === step.id);

            if (stepIndex > 0) {
              const prevStep = parentSteps[stepIndex - 1];
              // Check if previous step is a regular step (not parallel)
              if (prevStep?.type === 'step' && prevStep.step) {
                inputData = this.stepResults[prevStep.step.id];
              }
            }

            const result = await step.execute({
              inputData,
              getStepResult: stepToGet => this.stepResults[stepToGet.id],
            });

            // Store result for next steps
            this.stepResults[step.id] = result;
            return result;
          },
        },
      ];
    } else if (entry.type === 'parallel') {
      // For parallel steps, transform each step and return them as a group
      return entry.steps.map((step, i) => {
        const transformed = this.transformStepToInngest(step, entry.steps);
        if (transformed.length !== 1) {
          throw new Error('Nested parallel steps are not supported');
        }
        return transformed[0]!;
      });
    } else {
      throw new Error(`Step type ${entry.type} not yet supported in Inngest engine`);
    }
  }

  private async executeStep(stepConfig: InngestStepConfig, context: InngestContext) {
    const result = await stepConfig.handler(context);
    this.stepResults[stepConfig.id] = result;
    return result;
  }

  private createInngestFunction(functionId: string, steps: StepFlowEntry[]) {
    return this.inngest.createFunction(
      { id: functionId },
      { event: `workflow.${functionId}.start` },
      async ({ step, event }) => {
        let result: any;

        for (const entry of steps) {
          if (entry.type === 'step') {
            const [stepConfig] = this.transformStepToInngest(entry, steps);
            result = await step.run(stepConfig?.id!, async () => {
              return this.executeStep(stepConfig!, { step, event });
            });
          } else if (entry.type === 'parallel') {
            // Transform parallel steps
            const parallelSteps = this.transformStepToInngest(entry, entry.steps);

            // Create a group of functions to run in parallel
            const parallelFns = parallelSteps.map(stepConfig => {
              return async () => this.executeStep(stepConfig, { step, event });
            });

            // Run all steps in parallel using Promise.all
            const parallelResults = await Promise.all(
              parallelFns.map(fn =>
                step.run(`parallel-${entry.steps.map(s => (s.type === 'step' ? s.step.id : 'group')).join('-')}`, fn),
              ),
            );

            // Store results from parallel execution
            parallelSteps.forEach((stepConfig, i) => {
              this.stepResults[stepConfig.id] = parallelResults[i];
            });

            result = parallelResults;
          }
        }

        return result;
      },
    );
  }

  async execute<TInput, TOutput>(params: { graph: ExecutionGraph; input?: TInput }): Promise<TOutput> {
    const { graph, input } = params;

    // Store input in results for first step access
    this.stepResults = { input };

    // Create Inngest function for this workflow
    const workflowFunction = this.createInngestFunction(graph.id, graph.steps);

    // Wait for all steps to complete and get the final result
    const lastStep = graph.steps[graph.steps.length - 1];
    let finalStepId: string;

    if (lastStep?.type === 'step') {
      finalStepId = lastStep.step.id;
    } else if (lastStep?.type === 'parallel') {
      // For parallel steps, we'll take the last result from the parallel execution
      const lastParallelSteps = this.transformStepToInngest(lastStep, lastStep.steps);
      finalStepId = lastParallelSteps[lastParallelSteps.length - 1]?.id!;
    } else {
      throw new Error(`Unsupported step type: ${lastStep?.type}`);
    }

    const connection = await connect({
      apps: [{ client: this.inngest, functions: [workflowFunction] }],
    });

    // Execute the workflow by sending the start event
    const result = await this.inngest.send({
      name: `workflow.${graph.id}.start`,
      data: { input },
    });

    const run = await getRunOutput(result.ids?.[0]!);

    await connection.close();

    console.log(this.stepResults);

    return { result: this.stepResults[finalStepId], steps: this.stepResults } as TOutput;
  }
}

export class MastraInngestWorkflow<
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput extends z.ZodObject<any> = z.ZodObject<any>,
  TPrevSchema extends z.ZodObject<any> = TInput,
> extends NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  constructor(props: NewWorkflowConfig<TWorkflowId, TInput, TOutput>, inngest: Inngest) {
    super({
      ...props,
      executionEngine: new InngestExecutionEngine(inngest),
    });
  }
}
