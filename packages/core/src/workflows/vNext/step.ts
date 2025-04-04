import type { z } from 'zod';

// Define a type for the execute function
export type ExecuteFunction<TStepInput, TStepOutput> = (params: {
  inputData: TStepInput;
  getStepResult<T extends NewStep<any, any, any>>(
    stepId: T,
  ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
}) => Promise<TStepOutput>;

// Define a Step interface
export interface NewStep<
  TStepId extends string = string,
  TSchemaIn extends z.ZodType = z.ZodType<any>,
  TSchemaOut extends z.ZodType = z.ZodType<any>,
> {
  id: TStepId;
  description?: string;
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  execute: ExecuteFunction<z.infer<TSchemaIn>, z.infer<TSchemaOut>>;
}
