import { NativeConnection, Worker } from '@temporalio/worker';
import type { Activities, WorkerConfig } from './types';

export class WorkflowWorker {
  private static instance: WorkflowWorker;
  private worker: Worker | null = null;
  private steps: Record<string, any> = {};

  private constructor() {}

  static getInstance(): WorkflowWorker {
    if (!WorkflowWorker.instance) {
      WorkflowWorker.instance = new WorkflowWorker();
    }
    return WorkflowWorker.instance;
  }

  registerSteps(steps: Record<string, any>) {
    this.steps = { ...this.steps, ...steps };
  }

  private async ensureWorker(config: WorkerConfig) {
    if (!this.worker) {
      // Connect to temporal server
      const connection = await NativeConnection.connect({
        address: config.address || 'localhost:7233',
      });

      // Create activities implementation
      const activities: Activities = {
        executeStep: async ({ stepId, inputData, stepResults }) => {
          const step = this.steps[stepId];
          if (!step) {
            throw new Error(`Step ${stepId} not found in steps: ${Object.keys(this.steps).join(', ')}`);
          }

          try {
            const executedResult = await step.execute({
              inputData,
              getStepResult: (step: any) => {
                const result = stepResults[step.id];
                if (result?.status === 'success') {
                  return result.output;
                }

                return null;
              },
            });

            return {
              output: executedResult,
              status: 'success',
            };
          } catch (e) {
            console.error(e);
            return {
              status: 'error',
              error: e instanceof Error ? e.message : 'Unknown error',
            };
          }
        },
      };

      // Create the worker
      this.worker = await Worker.create({
        connection,
        namespace: config.namespace || 'default',
        taskQueue: config.taskQueue || 'mastra-workflows',
        workflowsPath: new URL(import.meta.resolve('./workflows')).pathname,
        activities,
      });

      // Start the worker in background
      this.worker.run().catch(err => {
        console.error('Worker error:', err);
        this.worker = null;
      });
    }
  }

  async start(config: WorkerConfig) {
    // Register steps first
    this.registerSteps(config.steps);

    // Ensure worker is running
    await this.ensureWorker(config);
  }

  async stop() {
    if (this.worker) {
      await this.worker.shutdown();
      this.worker = null;
    }
  }
}

// Export the singleton instance
export const workflowWorker = WorkflowWorker.getInstance();
