import { proxyActivities, executeChild, ParentClosePolicy } from '@temporalio/workflow';
import type { Activities } from './types';
import type { StepFlowEntry, NewStep } from '@mastra/core/workflows/vNext';
import type { NewWorkflow } from '@mastra/core/workflows/vNext';

const { executeStep } = proxyActivities<Activities>({
  startToCloseTimeout: '1 minute',
});

interface WorkflowState {
  stepResults: Record<string, any>;
  status: 'running' | 'completed' | 'failed' | 'suspended';
  currentStepId?: string;
  error?: string;
}

function getStepOutput(stepResults: Record<string, any>, step?: StepFlowEntry): any {
  if (!step) {
    return stepResults.input;
  } else if (step.type === 'step') {
    return stepResults[step.step.id]?.output;
  } else if (step.type === 'parallel' || step.type === 'conditional') {
    return step.steps.reduce(
      (acc, entry) => {
        if (entry.type === 'step') {
          acc[entry.step.id] = stepResults[entry.step.id]?.output;
        } else if (entry.type === 'parallel') {
          const parallelResult = getStepOutput(stepResults, entry)?.output;
          acc = { ...acc, ...parallelResult };
        }
        return acc;
      },
      {} as Record<string, any>,
    );
  } else if (step.type === 'loop') {
    return stepResults[step.step.id]?.output;
  }
}

/** @workflow */
export async function executeWorkflow(steps: StepFlowEntry[], input: any): Promise<WorkflowState> {
  const state: WorkflowState = {
    stepResults: { input },
    status: 'running',
  };

  try {
    for (let i = 0; i < steps.length; i++) {
      const entry = steps[i]!;
      const previousStep = i > 0 ? steps[i - 1] : undefined;
      state.currentStepId = entry.type === 'step' ? entry.step.id : undefined;

      console.log(state.stepResults, previousStep, '####');
      const prevOutput = getStepOutput(state.stepResults, previousStep);

      switch (entry.type) {
        case 'step': {
          console.log(entry.step.id);
          try {
            state.stepResults[entry.step.id] = await executeStepOrWorkflow(entry.step, prevOutput, state.stepResults);
          } catch (e) {
            console.error(e);
            throw e;
          }

          break;
        }

        case 'parallel': {
          const results = await Promise.all(
            entry.steps.map(step => {
              if (step.type !== 'step') {
                throw new Error('Nested parallel steps are not supported');
              }
              return executeStepOrWorkflow(step.step, prevOutput, state.stepResults);
            }),
          );

          entry.steps.forEach((step, idx) => {
            if (step.type === 'step') {
              state.stepResults[step.step.id] = results[idx];
            }
          });
          break;
        }

        case 'conditional': {
          const conditions = await Promise.all(
            entry.conditions.map(condition =>
              condition({
                inputData: prevOutput,
                getStepResult: (step: any) => state.stepResults[step.id]?.output,
                suspend: async () => {}, // TODO: Implement suspend
                emitter: undefined as any, // TODO: Handle events
              }),
            ),
          );

          const validSteps = entry.steps.filter((_, idx) => conditions[idx]);
          const results = await Promise.all(
            validSteps.map(step => {
              if (step.type !== 'step') {
                throw new Error('Nested conditional steps must be simple steps');
              }
              return executeStepOrWorkflow(step.step, prevOutput, state.stepResults);
            }),
          );

          validSteps.forEach((step, idx) => {
            if (step.type === 'step') {
              state.stepResults[step.step.id] = results[idx];
            }
          });
          break;
        }

        case 'loop': {
          let shouldContinue;
          let lastResult = prevOutput;

          do {
            lastResult = await executeStepOrWorkflow(entry.step, lastResult, state.stepResults);
            state.stepResults[entry.step.id] = lastResult;

            shouldContinue = await entry.condition({
              inputData: lastResult,
              getStepResult: (step: any) => state.stepResults[step.id]?.output,
              suspend: async () => {}, // TODO: Implement suspend
              emitter: undefined as any, // TODO: Handle events
            });
          } while (entry.loopType === 'dowhile' ? shouldContinue : !shouldContinue);
          break;
        }
      }
    }

    state.status = 'completed';

    return state;
  } catch (error) {
    state.status = 'failed';
    state.error = error instanceof Error ? error.message : 'Unknown error';
    return state;
  }
}

async function executeStepOrWorkflow(
  step: NewStep<string, any, any>,
  input: any,
  stepResults: Record<string, any>,
): Promise<any> {
  console.log(step, 'Step');
  // @ts-ignore
  if (step.then) {
    const workflow = step as NewWorkflow<any, any, any, any>;
    // Execute as child workflow
    const handle = await executeChild('executeWorkflow', {
      workflowId: `${workflow.id}-${Date.now()}`,
      parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_TERMINATE,
      args: [workflow.buildExecutionGraph().steps, input],
    });
    const result = await handle.result();
    return result.stepResults[step.id];
  } else {
    // Execute as activity
    return executeStep({
      stepId: step.id,
      inputData: input,
      stepResults,
    });
  }
}
