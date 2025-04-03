import { setup, assign, createActor, fromPromise } from 'xstate';

import { ExecutionEngine } from './execution-engine';
import type { ExecutionGraph } from './execution-engine';

interface WorkflowContext {
  input: any;
  stepResults: Record<string, any>;
  currentStepId: string | null;
  error?: Error;
}

type WorkflowEvent = { type: 'NEXT'; data?: any } | { type: 'ERROR'; error: Error } | { type: 'COMPLETE'; data?: any };

/**
 * Default implementation of the ExecutionEngine using XState
 */
export class DefaultExecutionEngine extends ExecutionEngine {
  /**
   * Transforms a workflow execution graph into an XState state machine
   * @param graph The execution graph to transform
   * @returns An XState state machine definition
   */
  transform(graph: ExecutionGraph) {
    const steps = graph.steps;

    if (!steps || steps?.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    const actors = steps.reduce(
      (acc, step) => {
        acc[step.id] = fromPromise(async props => {
          console.log('Running step.');
          //TODO
          return await step.execute(props as any);
        });
        return acc;
      },
      {} as Record<string, any>,
    );

    const states = steps.reduce(
      (acc, step, index) => {
        const nextStepId = steps[index + 1]?.id;

        acc[step.id] = {
          invoke: {
            src: step.id,
            input: (props: any) => props,
            onDone: {
              target: nextStepId ? nextStepId : 'completed',
            },
            onError: {
              target: 'failed',
            },
          },
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    const machine = setup({
      types: {
        context: {} as { count: number },
        events: {} as { type: 'inc' },
      },
      actors,
    }).createMachine({
      context: { count: 0 },
      initial: steps?.[0]?.id,
      states: {
        ...states,
        failed: {
          type: 'final',
        },
        completed: {
          type: 'final',
        },
      },
    });

    return machine;
  }

  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async execute<TInput, TOutput>(params: { graph: ExecutionGraph; input?: TInput }): Promise<TOutput> {
    const { graph, input } = params;
    const steps = graph.steps;

    if (steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    this.logger.info('Transforming execution graph to XState machine');
    // Transform the graph to get the states
    const transformedMachine = this.transform(graph);

    const actor = createActor(transformedMachine, { input });

    return new Promise<TOutput>(resolve => {
      actor.subscribe(state => {
        console.log(state.status, state.value, state.context);
        resolve(state.context as TOutput);
      });

      actor.start();
    });
  }
}
