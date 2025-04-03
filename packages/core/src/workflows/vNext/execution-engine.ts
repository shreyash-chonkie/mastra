import type { NewStep as Step } from './step';

/**
 * Represents an execution graph for a workflow
 */
export interface ExecutionGraph {
  id: string;
  steps: Step[];
  // Additional properties will be added in future implementations
}
/**
 * Execution engine abstract class for building and executing workflow graphs
 * Providers will implement this class to provide their own execution logic
 */
export abstract class ExecutionEngine {
  /**
   * Builds an execution graph from the provided steps
   * @param steps The steps to include in the execution graph
   * @returns The built execution graph
   */
  abstract buildExecutionGraph(steps: Step[]): ExecutionGraph;

  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  abstract execute<TInput, TOutput>(params: { graph: ExecutionGraph; input?: TInput }): Promise<TOutput>;
}
