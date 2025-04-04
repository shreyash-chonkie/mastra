import {
  ExecutionEngine,
  ExecutionGraph,
  StepFlowEntry,
  NewStep,
  NewWorkflow,
  NewWorkflowConfig,
} from '@mastra/core/workflows/vNext';
import { Client, Connection } from '@temporalio/client';
import { z } from 'zod';
import { workflowWorker } from './worker';

class TemporalExecutionEngine extends ExecutionEngine {
  private client: Client;
  private stepResults: Record<string, any> = {};

  constructor(client: Client) {
    super();
    this.client = client;
  }

  private async executeWorkflow(workflowId: string, steps: StepFlowEntry[], input: any) {
    // Start workflow
    const handle = await this.client.workflow.start('executeWorkflow', {
      args: [steps, input],
      taskQueue: 'mastra-workflows',
      workflowId,
    });

    // Wait for workflow completion and get results
    const result = await handle.result();
    this.stepResults = result;

    return result;
  }

  async execute<TInput, TOutput>(params: { graph: ExecutionGraph; input?: TInput }): Promise<TOutput> {
    const { graph, input } = params;
    const workflowId = `workflow-${graph.id}-${Date.now()}`;

    // Get all steps from graph
    const steps = graph.steps.reduce(
      (acc, entry) => {
        if (entry.type === 'step') {
          acc[entry.step.id] = entry.step;
        } else if (entry.type === 'parallel') {
          entry.steps.forEach(s => {
            if (s.type === 'step') {
              acc[s.step.id] = s.step;
            }
          });
        }
        return acc;
      },
      {} as Record<string, NewStep<string, any, any>>,
    );

    // Update worker config with steps
    await workflowWorker.start({
      steps,
    });

    // Execute workflow and get results
    const result = await this.executeWorkflow(workflowId, graph.steps, input);

    // Get final step ID
    const lastStep = graph.steps[graph.steps.length - 1];
    let finalStepId: string;

    if (lastStep?.type === 'step') {
      finalStepId = lastStep.step.id;
    } else if (lastStep?.type === 'parallel') {
      finalStepId =
        lastStep.steps[lastStep.steps.length - 1]?.type === 'step'
          ? lastStep.steps[lastStep.steps.length - 1].step.id
          : '';
    } else {
      throw new Error(`Unsupported step type: ${lastStep?.type}`);
    }

    return { result: this.stepResults[finalStepId], steps: this.stepResults } as TOutput;
  }
}

export class MastraTemporalWorkflow<
  TSteps extends NewStep<string, any, any>[] = NewStep<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput extends z.ZodObject<any> = z.ZodObject<any>,
  TPrevSchema extends z.ZodObject<any> = TInput,
> extends NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  private static client: Client;
  private static initialized = false;

  static async initialize(config?: { address?: string }) {
    if (!this.initialized) {
      const connection = await Connection.connect({
        address: config?.address || 'localhost:7233',
      });
      this.client = new Client({ connection });

      // Start the worker with empty steps
      await workflowWorker.start({
        address: config?.address,
        steps: {},
      });

      this.initialized = true;
    }
    return this.client;
  }

  constructor(props: NewWorkflowConfig<TWorkflowId, TInput, TOutput>) {
    if (!MastraTemporalWorkflow.initialized) {
      throw new Error('MastraTemporalWorkflow not initialized. Call initialize() first.');
    }

    super({
      ...props,
      executionEngine: new TemporalExecutionEngine(MastraTemporalWorkflow.client),
    });
  }
}
