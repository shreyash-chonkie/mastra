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
      lastOutput = await this.executeEntry({ entry, prevStep: steps[i - 1]!, stepResults });
    }

    return { steps: stepResults, result: lastOutput } as TOutput;
  }

  getStepOutput(stepResults: Record<string, any>, step?: StepFlowEntry): any {
    if (!step) {
      return stepResults.input;
    } else if (step.type === 'step') {
      return stepResults[step.step.id];
    } else if (step.type === 'parallel') {
      return step.steps.reduce(
        (acc, entry) => {
          if (entry.type === 'step') {
            acc[entry.step.id] = stepResults[entry.step.id];
          } else if (entry.type === 'parallel') {
            const parallelResult = this.getStepOutput(stepResults, entry);
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
      const result = await step.execute({
        inputData: prevOutput,
        getStepResult: (step: any) => stepResults[step.id],
      });

      stepResults[step.id] = result;
      return result;
    } else if (entry.type === 'parallel') {
      const results: any[] = await Promise.all(
        entry.steps.map(step => this.executeEntry({ entry: step, prevStep, stepResults })),
      );
      return results.reduce((acc, result) => ({ ...acc, ...result }), {});
    }
  }
}
