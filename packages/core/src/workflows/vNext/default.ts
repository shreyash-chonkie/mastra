import { setup, createActor, fromPromise, assign } from 'xstate';

import { ExecutionEngine } from './execution-engine';
import type { ExecutionGraph } from './execution-engine';
import type { StepFlowEntry } from '../workflow.warning';

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
          return acc;
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

    const states = this.buildSequentialStates(steps);
    console.log('states', states);

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

  getStepId(entry: StepFlowEntry): string {
    if (entry.type === 'step') {
      return entry.step.id;
    } else if (entry.type === 'parallel') {
      return `parallel-${entry.steps.map(this.getStepId).join('-')}`;
    } else if (entry.type === 'conditional') {
      return `conditional-${entry.steps.map(this.getStepId).join('-')}`;
    }

    throw new Error(`Step type not supported ${(entry as any).type}`);
  }

  buildSequentialStates(steps: StepFlowEntry[]) {
    const states = steps.reduce(
      (acc, entry, index) => {
        const stepId = this.getStepId(entry);
        const nextStep = steps[index + 1];
        const nextStepId = nextStep ? this.getStepId(nextStep) : undefined;

        if (entry.type === 'step') {
          acc[stepId] = {
            invoke: {
              src: stepId,
              input: (props: any) => props,
              onDone: {
                target: nextStepId ? nextStepId : 'completed',
                actions: [{ type: 'updateStepResult', params: { stepId: stepId } }],
              },
              onError: {
                target: 'failed',
                actions: [{ type: 'updateStepError', params: { stepId: stepId } }],
              },
            },
          };
        } else if (entry.type === 'parallel') {
          const states = {
            ...this.buildSequentialStates(entry.steps),
            failed: {
              type: 'final',
            },
            completed: {
              type: 'final',
            },
          };
          acc[stepId] = {
            type: 'parallel',
            states: { ...states, initial: this.getStepId(entry.steps[0]!) },
            onDone: {
              target: nextStepId ? nextStepId : 'completed',
              actions: [{ type: 'updateStepResult', params: { stepId: stepId } }],
            },
          };
        } else {
          throw new Error(`Step type not supported ${entry.type}`);
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    return states;
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
          if (!lastEntry) {
            return undefined;
          }

          const lastStepId = this.getStepId(lastEntry);
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
