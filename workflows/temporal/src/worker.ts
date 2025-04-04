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
        executeStep: async ({ stepId, inputData }) => {
          const step = this.steps[stepId];
          if (!step) {
            throw new Error(`Step ${stepId} not found in steps: ${Object.keys(this.steps).join(', ')}`);
          }

          return step.execute({
            inputData,
            getStepResult: (stepToGet: any) => {
              // This will be handled by the workflow
              return undefined;
            },
          });
        },
      };

      // Create the worker
      this.worker = await Worker.create({
        connection,
        namespace: config.namespace || 'default',
        taskQueue: config.taskQueue || 'mastra-workflows',
        workflowsPath: require.resolve('./workflows'),
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
