import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import path from 'path';
import { z } from 'zod';
import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import type { MastraStorage } from '../../storage';
import { DefaultStorage } from '../../storage/libsql';
import { DefaultExecutionEngine } from './default';
import type { ExecutionEngine, ExecutionGraph } from './execution-engine';
import type { ExecuteFunction, NewStep, NewStep as Step } from './step';
import type { StepsRecord, StepResult, WatchEvent } from './types';

export type StepFlowEntry =
  | { type: 'step'; step: Step }
  | {
      type: 'parallel';
      steps: StepFlowEntry[];
    }
  | {
      type: 'conditional';
      steps: StepFlowEntry[];
      conditions: ExecuteFunction<any, any>[];
    };

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
export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodObject<any>,
  TStepOutput extends z.ZodObject<any>,
>(params: {
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

export function createWorkflow<
  TWorkflowId extends string = string,
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput extends z.ZodObject<any> = z.ZodObject<any>,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
>(params: NewWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
  return new NewWorkflow(params);
}

export type NewWorkflowConfig<
  TWorkflowId extends string = string,
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput extends z.ZodObject<any> = z.ZodObject<any>,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
> = {
  id: TWorkflowId;
  description?: string | undefined;
  inputSchema: TInput;
  outputSchema: TOutput;
  executionEngine?: ExecutionEngine;
  steps?: TSteps;
};

export class NewWorkflow<
    TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
    TWorkflowId extends string = string,
    TInput extends z.ZodObject<any> = z.ZodObject<any>,
    TOutput extends z.ZodObject<any> = z.ZodObject<any>,
    TPrevSchema extends z.ZodObject<any> = TInput,
  >
  extends MastraBase
  implements NewStep<TWorkflowId, TInput, TOutput>
{
  public id: TWorkflowId;
  public description?: string | undefined;
  public inputSchema: TInput;
  public outputSchema: TOutput;
  protected stepFlow: StepFlowEntry[];
  protected executionEngine: ExecutionEngine;
  protected storage: MastraStorage;
  protected executionGraph: ExecutionGraph;

  constructor({
    id,
    inputSchema,
    outputSchema,
    description,
    executionEngine,
  }: NewWorkflowConfig<TWorkflowId, TInput, TOutput>) {
    super({ name: id, component: RegisteredLogger.WORKFLOW });
    this.id = id;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.executionGraph = this.buildExecutionGraph();
    this.stepFlow = [];

    // TODO: ability to pass this from mastra intsance
    this.storage = new DefaultStorage({
      config: {
        url: `file:${path.join(__dirname, 'mastra.db')}`,
      },
    });

    if (!executionEngine) {
      // TODO: this should be configured using the Mastra class instance that's passed in
      this.executionEngine = new DefaultExecutionEngine({ storage: this.storage });
    } else {
      this.executionEngine = executionEngine;
    }
  }

  /**
   * Adds a step to the workflow
   * @param step The step to add to the workflow
   * @returns The workflow instance for chaining
   */
  then<TStepId extends string, TSchemaOut extends z.ZodObject<any>>(step: Step<TStepId, TPrevSchema, TSchemaOut>) {
    this.stepFlow.push({ type: 'step', step: step as any });
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  map<
    TStepRef extends Step<string, any, any>,
    TMapping extends Record<
      string,
      {
        step: TStepRef;
        path: keyof z.infer<TStepRef['outputSchema']>;
      }
    >,
    // Extract the actual Zod types from the referenced steps
    TSchemaOut extends z.ZodObject<any> = z.ZodObject<
      {
        [K in keyof TMapping]: TMapping[K]['step']['outputSchema']['shape'][TMapping[K]['path']];
      },
      'strip',
      z.ZodTypeAny
    >,
  >(mappingConfig: TMapping) {
    // Create an implicit step that handles the mapping
    const mappingStep = createStep({
      id: `mapping_${randomUUID()}`,
      inputSchema: this.inputSchema as any,
      outputSchema: z.object(
        Object.entries(mappingConfig).reduce(
          (acc, [key, mapping]) => ({
            ...acc,
            [key]: mapping.step.outputSchema.shape[mapping.path as keyof typeof mapping.step.outputSchema.shape],
          }),
          {},
        ),
      ) as TSchemaOut,
      execute: async ({ getStepResult }) => {
        const result: Record<string, any> = {};
        for (const [key, mapping] of Object.entries(mappingConfig)) {
          const stepResult = getStepResult(mapping.step);
          result[key] = stepResult[mapping.path];
        }
        return result;
      },
    });

    this.stepFlow.push({ type: 'step', step: mappingStep as any });
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  parallel<TParallelSteps extends Step<string, TPrevSchema, any>[]>(steps: TParallelSteps) {
    this.stepFlow.push({ type: 'parallel', steps: steps.map(step => ({ type: 'step', step: step as any })) });
    return this as unknown as NewWorkflow<
      TSteps,
      TWorkflowId,
      TInput,
      TOutput,
      z.ZodObject<
        {
          [K in keyof StepsRecord<TParallelSteps>]: StepsRecord<TParallelSteps>[K]['outputSchema'];
        },
        'strip',
        z.ZodTypeAny
      >
    >;
  }

  branch<TBranchSteps extends Array<[ExecuteFunction<z.infer<TPrevSchema>, any>, Step<string, TPrevSchema, any>]>>(
    steps: TBranchSteps,
  ) {
    this.stepFlow.push({
      type: 'conditional',
      steps: steps.map(([_cond, step]) => ({ type: 'step', step: step as any })),
      conditions: steps.map(([cond]) => cond),
    });

    // Extract just the Step elements from the tuples array
    type BranchStepsArray = { [K in keyof TBranchSteps]: TBranchSteps[K][1] };

    // This creates a mapped type that extracts the second element from each tuple
    type ExtractedSteps = BranchStepsArray[number];

    // Now we can use this type as an array, similar to TParallelSteps
    return this as unknown as NewWorkflow<
      TSteps,
      TWorkflowId,
      TInput,
      TOutput,
      z.ZodObject<
        {
          [K in keyof StepsRecord<ExtractedSteps[]>]: StepsRecord<ExtractedSteps[]>[K]['outputSchema'];
        },
        'strip',
        z.ZodTypeAny
      >
    >;
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
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TOutput>;
  }

  /**
   * Creates a new workflow run instance
   * @param options Optional configuration for the run
   * @returns A Run instance that can be used to execute the workflow
   */
  createRun(options?: { runId?: string }): Run<TSteps, TInput, TOutput> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    return new Run({
      workflowId: this.id,
      runId: runIdToUse,
      executionEngine: this.executionEngine,
      executionGraph: this.executionGraph,
      storage: this.storage,
    });
  }

  async execute({
    inputData,
    suspend,
    resume,
    emitter,
  }: {
    inputData: z.infer<TInput>;
    getStepResult<T extends NewStep<any, any, any>>(
      stepId: T,
    ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
    suspend: (suspendPayload: any) => Promise<void>;
    resume?: {
      steps: NewStep<string, any, any>[];
      resumePayload: any;
      runId?: string;
    };
    emitter: EventEmitter;
  }): Promise<z.infer<TOutput>> {
    if (resume?.steps?.length) {
      console.log('Resuming', { inputData, step: resume.steps.map(step => step.id), runId: resume.runId });
      const run = this.createRun({ runId: resume.runId });
      const unwatch = run.watch(event => {
        // TODO: prefix events with workflowId
        emitter.emit('watch', event);
      });
      const res = await run.resume({ inputData, step: resume.steps as any });
      unwatch();
      return res.result;
    }

    const run = this.createRun();
    const unwatch = run.watch(event => {
      // TODO: prefix events with workflowId
      emitter.emit('watch', event);
    });
    const res = await run.start({ inputData });
    unwatch();
    console.dir({ res }, { depth: null });
    const suspendedSteps = Object.entries(res.steps).filter(([stepName, stepResult]) => {
      const stepRes: StepResult<any> = stepResult as StepResult<any>;
      if (stepRes?.status === 'suspended') {
        return stepName;
      }

      return false;
    });

    if (suspendedSteps?.length) {
      console.log('Suspending', suspendedSteps);
      const _stepName = suspendedSteps![0]?.[0];
      const stepResult = suspendedSteps![0]?.[1] as any;
      await suspend({ __workflow_meta: { runId: run.runId }, ...stepResult?.payload });
    }

    return res.result;
  }
}

/**
 * Represents a workflow run that can be executed
 */
export class Run<
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput extends z.ZodObject<any> = z.ZodObject<any>,
> {
  protected emitter: EventEmitter;
  /**
   * Unique identifier for this workflow
   */
  readonly workflowId: string;

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

  /**
   * The storage for this run
   */
  public storage: MastraStorage;

  constructor(params: {
    workflowId: string;
    runId: string;
    executionEngine: ExecutionEngine;
    executionGraph: ExecutionGraph;
    storage: MastraStorage;
  }) {
    this.workflowId = params.workflowId;
    this.runId = params.runId;
    this.executionEngine = params.executionEngine;
    this.executionGraph = params.executionGraph;
    this.storage = params.storage;
    this.emitter = new EventEmitter();
  }

  /**
   * Starts the workflow execution with the provided input
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async start({ inputData }: { inputData?: z.infer<TInput> }): Promise<{
    result: TOutput;
    steps: {
      [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
        ? StepResult<unknown>
        : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
    };
  }> {
    return this.executionEngine.execute<
      z.infer<TInput>,
      {
        result: TOutput;
        steps: {
          [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
            ? StepResult<unknown>
            : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
        };
      }
    >({
      workflowId: this.workflowId,
      runId: this.runId,
      graph: this.executionGraph,
      input: inputData,
      emitter: this.emitter,
    });
  }

  watch(cb: (event: WatchEvent) => void): () => void {
    this.emitter.on('watch', cb);
    return () => {
      this.emitter.off('watch', cb);
    };
  }

  async resume<TInput extends z.ZodObject<any>>(params: {
    inputData?: z.infer<TInput>;
    step: Step<string, TInput, any> | [...Step<string, any, any>[], Step<string, TInput, any>];
  }): Promise<{
    result: TOutput;
    steps: {
      [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
        ? StepResult<unknown>
        : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
    };
  }> {
    const steps = Array.isArray(params.step) ? params.step : [params.step];
    const snapshot = await this.storage.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    return this.executionEngine.execute<
      z.infer<TInput>,
      {
        result: TOutput;
        steps: {
          [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
            ? StepResult<unknown>
            : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
        };
      }
    >({
      workflowId: this.workflowId,
      runId: this.runId,
      graph: this.executionGraph,
      input: params.inputData,
      resume: {
        steps,
        stepResults: snapshot?.context as any,
        resumePayload: params.inputData,
        resumePath: snapshot?.suspendedPaths?.[steps?.[0]?.id!] as any,
      },
      emitter: this.emitter,
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
