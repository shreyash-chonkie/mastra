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
      (acc, entry, index) => {
        if (entry.type !== 'step') {
          throw new Error('Step is not a step');
        }
        const { step } = entry;

        acc[step.id] = fromPromise(async ({ input }) => {
          console.log('Running step', step.id);
          const inputArg = input as any;

          let inputData = {};
          const stepsFromContext = inputArg.context.steps;

          if (index === 0) {
            inputData = inputArg.context.inputData;
          } else {
            const prevStep = steps?.[index - 1];
            if (prevStep?.type !== 'step') {
              throw new Error('Previous step is not a step');
            }
            inputData = stepsFromContext?.[prevStep.step.id]?.output;
          }

          //TODO
          const stepOutput = await step.execute({
            inputData,
            getStepResult: step => {
              return stepsFromContext[step.id]?.output;
            },
          });

          return { stepId: step.id, result: stepOutput };
        });
        return acc;
      },
      {} as Record<string, any>,
    );

    const initialStep = steps[0];
    if (initialStep?.type !== 'step') {
      throw new Error('Initial step is not a step');
    }
    const initialStepId = initialStep.step.id;

    const states = steps.reduce(
      (acc, entry, index) => {
        if (entry.type !== 'step') {
          throw new Error('Step is not a step');
        }
        const { step } = entry;
        const nextStep = steps[index + 1];
        if (nextStep?.type !== 'step') {
          throw new Error('Next step is not a step');
        }
        const nextStepId = nextStep.step.id;

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
      initial: initialStepId,
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
  // TODO: OVERLOAD TO SUPPORT TOUTPUT PLUS STEPS
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
          const lastEntry = steps[steps.length - 1];
          if (lastEntry?.type !== 'step') {
            throw new Error('Last step is not a step');
          }

          const lastStepId = lastEntry.step.id;

          const stepsFromContext = state.context.steps?.[lastStepId];

          if (!stepsFromContext) {
            throw new Error('Last step not found in context');
          }

          resolve({ steps: state.context.steps, result: stepsFromContext.output } as TOutput);
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
