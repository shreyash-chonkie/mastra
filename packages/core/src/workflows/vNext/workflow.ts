import { randomUUID } from 'crypto';
import type { z } from 'zod';
import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import { DefaultExecutionEngine } from './default';
import type { ExecutionEngine, ExecutionGraph } from './execution-engine';
import type { ExecuteFunction, NewStep as Step } from './step';

export class NewWorkflow<
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput extends z.ZodObject<any> = z.ZodObject<any>,
> extends MastraBase {
  protected inputSchema: TInput;
  protected outputSchema: TOutput;
  protected stepFlow: Step[];
  protected executionEngine: ExecutionEngine;
  protected executionGraph: ExecutionGraph;

  constructor({
    id,
    inputSchema,
    outputSchema,
    executionEngine = new DefaultExecutionEngine(),
  }: {
    id: TWorkflowId;
    inputSchema: TInput;
    outputSchema: TOutput;
    executionEngine?: ExecutionEngine;
    steps?: TSteps;
  }) {
    super({ name: id, component: RegisteredLogger.WORKFLOW });
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.executionEngine = executionEngine;
    this.executionGraph = this.buildExecutionGraph();
    this.stepFlow = [];
  }

  /**
   * Adds a step to the workflow
   * @param step The step to add to the workflow
   * @returns The workflow instance for chaining
   */
  then<TStepId extends string, TSchemaIn extends z.ZodType, TSchemaOut extends z.ZodType>(
    step: Step<TStepId, TSchemaIn, TSchemaOut>,
  ): this {
    this.stepFlow.push(step as any); // Type assertion needed due to variance issues
    return this;
  }

  /**
   * Creates a new workflow step
   * @param params Configuration parameters for the step
   * @param params.id Unique identifier for the step
   * @param params.description Optional description of what the step does
   * @param params.inputSchema Zod schema defining the input structure
   * @param params.outputSchema Zod schema defining the output structure
   * @param params.execute Function that performs the step's operations
   * @returns A Step object that can be added to the workflow
   */
  createStep<TStepId extends string, TStepInput extends z.ZodType, TStepOutput extends z.ZodType>(params: {
    id: TStepId;
    description?: string;
    inputSchema: TStepInput;
    outputSchema: TStepOutput;
    execute: ExecuteFunction<z.infer<TStepInput>, z.infer<TStepOutput>>;
  }): Step<TStepId, TStepInput, TStepOutput> {
    return {
      id: params.id,
      description: params.description,
      inputSchema: params.inputSchema,
      outputSchema: params.outputSchema,
      execute: params.execute,
    };
  }

  /**
   * Builds the execution graph for this workflow
   * @returns The execution graph that can be used to execute the workflow
   */
  buildExecutionGraph(): ExecutionGraph {
    return {
      id: randomUUID(),
      steps: this.stepFlow,
    };
  }

  /**
   * Finalizes the workflow definition and prepares it for execution
   * This method should be called after all steps have been added to the workflow
   * @returns A built workflow instance ready for execution
   */
  commit() {
    this.executionGraph = this.buildExecutionGraph();
    return this;
  }

  /**
   * Creates a new workflow run instance
   * @param options Optional configuration for the run
   * @returns A Run instance that can be used to execute the workflow
   */
  createRun(options?: { runId?: string }): Run<TInput, TOutput> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    return new Run({
      runId: runIdToUse,
      executionEngine: this.executionEngine,
      executionGraph: this.executionGraph,
    });
  }
}

/**
 * Represents a workflow run that can be executed
 */
export class Run<TInput extends z.ZodObject<any>, TOutput extends z.ZodObject<any>> {
  /**
   * Unique identifier for this run
   */
  readonly runId: string;

  /**
   * Internal state of the workflow run
   */
  protected state: Record<string, any> = {};

  /**
   * The execution engine for this run
   */
  public executionEngine: ExecutionEngine;

  /**
   * The execution graph for this run
   */
  public executionGraph: ExecutionGraph;

  constructor(params: { runId: string; executionEngine: ExecutionEngine; executionGraph: ExecutionGraph }) {
    this.runId = params.runId;
    this.executionEngine = params.executionEngine;
    this.executionGraph = params.executionGraph;
  }

  /**
   * Starts the workflow execution with the provided input
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async start(input?: z.infer<TInput>): Promise<z.infer<TOutput>> {
    return this.executionEngine.execute<z.infer<TInput>, z.infer<TOutput>>({
      graph: this.executionGraph,
      input,
    });
  }

  /**
   * Returns the current state of the workflow run
   * @returns The current state of the workflow run
   */
  getState(): Record<string, any> {
    return this.state;
  }
}
