import { randomUUID } from 'crypto';
import type { ExecutionGraph } from './execution-engine';
import { ExecutionEngine } from './execution-engine';
import type { NewStep as Step } from './step';

/**
 * Default implementation of the ExecutionEngine
 */
export class DefaultExecutionEngine extends ExecutionEngine {
  /**
   * Builds an execution graph from the provided steps
   * @param steps The steps to include in the execution graph
   * @returns The built execution graph
   */
  buildExecutionGraph(steps: Step[]): ExecutionGraph {
    return {
      id: randomUUID(),
      steps,
    };
  }

  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async execute<TInput, TOutput>(params: { graph: ExecutionGraph; input?: TInput }): Promise<TOutput> {
    // Default implementation - concrete engines will override this
    return {} as TOutput;
  }
}
