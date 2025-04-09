import type { NewStep } from '@mastra/core/workflows/vNext';

// Interface for workflow activities
export interface Activities {
  executeStep(params: { stepId: string; inputData: any; stepResults: Record<string, any> }): Promise<any>;
}

// Configuration for workflow worker
export interface WorkerConfig {
  address?: string;
  namespace?: string;
  taskQueue?: string;
  steps: Record<string, { step: NewStep<string, any, any>; condition: any }>;
}

// Input/output types for workflow steps
export interface StepInput {
  inputData: any;
  getStepResult?: (stepId: string) => any;
}

export interface StepOutput {
  result: any;
  steps: Record<string, any>;
}
