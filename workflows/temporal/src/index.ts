import { DefaultExecutionEngine, ExecutionEngine, NewWorkflow } from '@mastra/core/workflows/vNext';
import type { ExecutionGraph, StepFlowEntry, NewStep, NewWorkflowConfig } from '@mastra/core/workflows/vNext';
import EventEmitter from 'events';
import { Client, Connection } from '@temporalio/client';
import { z } from 'zod';
import { workflowWorker } from './worker';
import { DefaultStorage } from '@mastra/core/storage/libsql';

class TemporalExecutionEngine extends DefaultExecutionEngine {
  private client: Client;
  private stepResults: Record<string, any> = {};
  private emitter: EventEmitter;

  constructor({ client }: { client: Client }) {
    const storage = new DefaultStorage({
      config: {
        url: ':memory:',
      },
    });

    super({ storage });
    this.client = client;
    this.emitter = new EventEmitter();
  }

  private async executeWorkflow(workflowId: string, steps: StepFlowEntry[], input: any) {
    console.log('WE ARE IN THAT BITCH');
    // Register steps with the worker
    const registeredSteps = this.collectSteps(steps);
    await workflowWorker.start({
      steps: registeredSteps,
    });

    // Start workflow
    const handle = await this.client.workflow.start('executeWorkflow', {
      args: [steps, input],
      taskQueue: 'mastra-workflows',
      workflowId,
    });

    // Set up workflow completion handling
    try {
      const result = await handle.result();
      console.log('YOOO', result);
      this.stepResults = result.stepResults;
      return result;
    } catch (error) {
      // Handle workflow failures
      this.emitter.emit('watch', {
        type: 'watch',
        payload: {
          workflowState: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        eventTimestamp: Date.now(),
      });
      throw error;
    }
  }

  private collectSteps(entries: StepFlowEntry[]): Record<string, NewStep<string, any, any>> {
    const steps: Record<string, NewStep<string, any, any>> = {};

    console.log({ entries });

    for (const entry of entries) {
      switch (entry.type) {
        case 'step':
          steps[entry.step.id] = entry.step;
          // If it's a workflow, collect its steps too
          if (entry.step instanceof NewWorkflow) {
            const subSteps = this.collectSteps(entry.step.buildExecutionGraph().steps);
            Object.assign(steps, subSteps);
          }
          break;

        case 'parallel':
        case 'conditional':
          for (const step of entry.steps) {
            if (step.type === 'step') {
              steps[step.step.id] = step.step;
              if (step.step instanceof NewWorkflow) {
                const subSteps = this.collectSteps(step.step.buildExecutionGraph().steps);
                Object.assign(steps, subSteps);
              }
            }
          }
          break;

        case 'loop':
          steps[entry.step.id] = entry.step;
          if (entry.step instanceof NewWorkflow) {
            const subSteps = this.collectSteps(entry.step.buildExecutionGraph().steps);
            Object.assign(steps, subSteps);
          }
          break;
      }
    }

    return steps;
  }

  async execute<TInput, TOutput>(params: {
    graph: ExecutionGraph;
    input?: TInput;
    resume?: {
      steps: NewStep<string, any, any>[];
      resumePayload: any;
      resumePath: number[];
    };
    emitter: EventEmitter;
  }): Promise<TOutput> {
    const { graph, input, resume, emitter } = params;
    const workflowId = `workflow-${graph.id}-${Date.now()}`;

    // Set up event forwarding
    this.emitter = emitter;

    try {
      // Execute workflow and get results
      const result = await this.executeWorkflow(workflowId, graph.steps, input);

      // Return final result
      return {
        steps: result.stepResults,
        result: result.stepResults[this.getFinalStepId(graph.steps)].output,
        status: result.status,
      } as TOutput;
    } catch (error) {
      return {
        steps: this.stepResults,
        result: null,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as TOutput;
    }
  }

  private getFinalStepId(steps: StepFlowEntry[]): string {
    const lastStep = steps[steps.length - 1];
    if (!lastStep) throw new Error('No steps in workflow');

    switch (lastStep.type) {
      case 'step':
        return lastStep.step.id;
      case 'parallel':
      case 'conditional':
        const lastParallelStep = lastStep.steps[lastStep.steps.length - 1];
        if (lastParallelStep?.type === 'step') {
          return lastParallelStep.step.id;
        }
        throw new Error(`Invalid last step type: ${lastParallelStep?.type}`);
      case 'loop':
        return lastStep.step.id;
      default:
        throw new Error(`Unsupported step type: ${(lastStep as any).type}`);
    }
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
      executionEngine: new TemporalExecutionEngine({ client: MastraTemporalWorkflow.client }),
    });
  }
}
