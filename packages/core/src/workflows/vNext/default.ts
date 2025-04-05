import type { ExecutionGraph } from './execution-engine';
import { ExecutionEngine } from './execution-engine';
import type { StepFlowEntry } from './workflow';

/**
 * Default implementation of the ExecutionEngine using XState
 */
export class DefaultExecutionEngine extends ExecutionEngine {
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

    const stepResults: Record<string, any> = { input };
    let lastOutput: any;
    for (let i = 0; i < steps.length; i++) {
      const entry = steps[i]!;
      try {
        lastOutput = await this.executeEntry({ entry, prevStep: steps[i - 1]!, stepResults });
      } catch (e) {
        console.log('Error', e);
        return {
          steps: stepResults,
          result: lastOutput,
          error: e instanceof Error ? e.message : 'Unknown error',
        } as TOutput;
      }
    }

    return { steps: stepResults, result: lastOutput } as TOutput;
  }

  getStepOutput(stepResults: Record<string, any>, step?: StepFlowEntry): any {
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
            const parallelResult = this.getStepOutput(stepResults, entry)?.output;
            acc = { ...acc, ...parallelResult };
          }
          return acc;
        },
        {} as Record<string, any>,
      );
    }
  }

  async executeEntry({
    entry,
    prevStep,
    stepResults,
  }: {
    entry: StepFlowEntry;
    prevStep: StepFlowEntry;
    stepResults: Record<string, any>;
  }) {
    const prevOutput = this.getStepOutput(stepResults, prevStep);

    if (entry.type === 'step') {
      const { step } = entry;
      try {
        const result = await step.execute({
          inputData: prevOutput,
          getStepResult: (step: any) => stepResults[step.id]?.output,
        });

        stepResults[step.id] = { status: 'success', output: result };
        return result;
      } catch (e) {
        stepResults[step.id] = { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' };
        throw e;
      }
    } else if (entry.type === 'parallel') {
      const results: any[] = await Promise.all(
        entry.steps.map(step => this.executeEntry({ entry: step, prevStep, stepResults })),
      );
      return results.reduce((acc, result) => ({ ...acc, ...result }), {});
    } else if (entry.type === 'conditional') {
      const truthyIndexes = (
        await Promise.all(
          entry.conditions.map(async (cond, index) => {
            try {
              const result = await cond({
                inputData: prevOutput,
                getStepResult: (step: any) => stepResults[step.id]?.output,
              });
              return result ? index : null;
            } catch (e: unknown) {
              return null;
            }
          }),
        )
      ).filter((index): index is number => index !== null);

      const stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));
      const results: any[] = await Promise.all(
        stepsToRun.map(step => this.executeEntry({ entry: step, prevStep, stepResults })),
      );
      return results.reduce((acc, result) => ({ ...acc, ...result }), {});
    }
  }
}
