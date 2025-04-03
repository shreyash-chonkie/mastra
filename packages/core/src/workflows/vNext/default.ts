import { setup, createActor, fromPromise, assign } from 'xstate';

import { ExecutionEngine } from './execution-engine';
import type { ExecutionGraph } from './execution-engine';

/**
 * Default implementation of the ExecutionEngine using XState
 */
export class DefaultExecutionEngine extends ExecutionEngine {
  /**
   * Transforms a workflow execution graph into an XState state machine
   * @param graph The execution graph to transform
   * @returns An XState state machine definition
   */
  transform<TInput, TOutput>(params: { graph: ExecutionGraph; input?: TInput }) {
    const { graph, input } = params;
    const steps = graph.steps;

    if (!steps || steps?.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    const actors = steps.reduce(
      (acc, step, index) => {
        acc[step.id] = fromPromise(async ({ input }) => {
          console.log('Running step', step.id);
          const inputArg = input as any;

          let inputData = {};
          const stepsFromContext = inputArg.context.steps;

          if (index === 0) {
            inputData = inputArg.context.inputData;
          } else if (steps?.[index - 1]?.id) {
            inputData = stepsFromContext?.[steps?.[index - 1]?.id!]?.output;
          }

          //TODO
          const stepOutput = await step.execute({ inputData });

          return { stepId: step.id, result: stepOutput };
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
              actions: [{ type: 'updateStepResult', params: { stepId: step.id } }],
            },
            onError: {
              target: 'failed',
              actions: [{ type: 'updateStepError', params: { stepId: step.id } }],
            },
          },
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    const machine = setup({
      types: {
        //TODO: Remove any
        context: {
          inputData: {} as TInput,
        } as any,
        input: {} as TInput,
        output: {} as TOutput,
      },
      actions: {
        updateStepResult: assign({
          steps: ({ context, event }) => {
            const { stepId, result } = event.output;
            return {
              ...context.steps,
              [stepId]: {
                status: 'success' as const,
                output: result,
              },
            };
          },
        }),
        updateStepError: assign({
          steps: ({ context, event }) => {
            const { stepId, error } = event.output;
            return {
              ...context.steps,
              // TODO: need error messages
              [stepId]: {
                status: 'error' as const,
                error,
              },
            };
          },
        }),
      },
      actors,
    }).createMachine({
      context: {
        inputData: input,
        steps: {},
      },
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
    const transformedMachine = this.transform<TInput, TOutput>({ graph, input });

    const actor = createActor(transformedMachine, { input });

    return new Promise<TOutput>((resolve, reject) => {
      actor.subscribe(state => {
        if (state.value === 'completed') {
          const lastStepId = steps[steps.length - 1]!.id;

          const stepsFromContext = state.context.steps?.[lastStepId];

          if (!stepsFromContext) {
            throw new Error('Last step not found in context');
          }

          resolve(stepsFromContext.output as TOutput);
        }

        if (state.value === 'failed') {
          //TODO: Handle errors
          reject(new Error('Workflow execution failed'));
        }
      });

      actor.start();
    });
  }
}
