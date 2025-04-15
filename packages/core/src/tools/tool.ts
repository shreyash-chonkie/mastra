import type { z } from 'zod';

import type { Mastra } from '../mastra';
import type { ToolAction, ToolExecutionContext } from './types';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
> implements ToolAction<TSchemaIn, TSchemaOut, TContext>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'];
  mastra?: Mastra;

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;
    this.mastra = opts.mastra;
  }
}

export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
  TExecute extends ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'] = ToolAction<
    TSchemaIn,
    TSchemaOut,
    TContext
  >['execute'],
>(
  opts: ToolAction<TSchemaIn, TSchemaOut, TContext> & {
    execute?: TExecute;
  },
): TSchemaIn extends z.ZodSchema
  ? TSchemaOut extends z.ZodSchema
    ? TExecute extends undefined
      ? Tool<TSchemaIn, TSchemaOut, TContext> & {
          inputSchema: TSchemaIn;
          outputSchema: TSchemaOut;
        }
      : Tool<TSchemaIn, TSchemaOut, TContext> & {
          inputSchema: TSchemaIn;
          outputSchema: TSchemaOut;
          execute: (context: TContext) => Promise<any>;
        }
    : Tool<TSchemaIn, undefined, TContext> & {
        inputSchema: TSchemaIn;
      }
  : TSchemaOut extends z.ZodSchema
    ? Tool<undefined, TSchemaOut, ToolExecutionContext<undefined>> & {
        outputSchema: TSchemaOut;
      }
    : Tool<undefined, undefined, ToolExecutionContext<undefined>> {
  return new Tool(opts) as any;
}
