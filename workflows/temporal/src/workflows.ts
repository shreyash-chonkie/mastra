import { proxyActivities } from '@temporalio/workflow';
import type { Activities } from './types';
import type { StepFlowEntry } from '@mastra/core/workflows/vNext';

const { executeStep } = proxyActivities<Activities>({
  startToCloseTimeout: '1 minute',
});

/** @workflow */
export async function executeWorkflow(steps: StepFlowEntry[], input: any) {
  const stepResults: Record<string, any> = { input };

  for (let i = 0; i < steps.length; i++) {
    const entry = steps[i]!;
    const previousStep = i > 0 ? steps[i - 1] : undefined;

    if (entry.type === 'step') {
      // Get input from previous step or workflow input
      const inputData =
        previousStep?.type === 'step'
          ? stepResults[previousStep.step.id]
          : previousStep?.type === 'parallel'
            ? previousStep.steps.reduce(
                (acc, s) => {
                  if (s.type === 'step' && s.step) {
                    acc[s.step.id] = stepResults[s.step.id];
                  }
                  return acc;
                },
                {} as Record<string, any>,
              )
            : stepResults['input'];

      // Execute step as an activity
      const result = await executeStep({
        stepId: entry.step.id,
        inputData,
      });

      stepResults[entry.step.id] = result;
    } else if (entry.type === 'parallel') {
      // For parallel steps, execute them concurrently
      const inputData = previousStep?.type === 'step' ? stepResults[previousStep.step.id] : stepResults['input'];

      const promises = entry.steps.map(async step => {
        if (step.type !== 'step') {
          throw new Error('Nested parallel steps are not supported');
        }

        const result = await executeStep({
          stepId: step.step.id,
          inputData,
        });

        stepResults[step.step.id] = result;
        return result;
      });

      await Promise.all(promises);
    }
  }

  return stepResults;
}
