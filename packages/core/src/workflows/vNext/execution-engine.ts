import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import type { StepFlowEntry } from '.';

/**
 * Represents an execution graph for a workflow
 */
export interface ExecutionGraph {
  id: string;
  steps: StepFlowEntry[];
  // Additional properties will be added in future implementations
}
/**
 * Execution engine abstract class for building and executing workflow graphs
 * Providers will implement this class to provide their own execution logic
 */
export abstract class ExecutionEngine extends MastraBase {
  constructor() {
    super({ name: 'ExecutionEngine', component: RegisteredLogger.WORKFLOW });
  }
  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  abstract execute<TInput, TOutput>(params: { graph: ExecutionGraph; input?: TInput }): Promise<TOutput>;
}
