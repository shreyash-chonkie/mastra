import type { z } from 'zod';

// Define a type for the execute function
export type ExecuteFunction<TStepInput, TStepOutput> = (params: { inputData: TStepInput }) => Promise<TStepOutput>;

// Define a Step interface
export interface NewStep<TStepInput = any, TStepOutput = any> {
  id: string;
  description?: string;
  inputSchema: z.ZodType<TStepInput>;
  outputSchema: z.ZodType<TStepOutput>;
  execute: ExecuteFunction<TStepInput, TStepOutput>;
}
