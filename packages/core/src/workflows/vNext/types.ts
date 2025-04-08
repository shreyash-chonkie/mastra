import type { z } from 'zod';
import type { NewStep } from './step';

export type StepSuccess<T> = {
  status: 'success';
  output: T;
};

export type StepFailure = {
  status: 'failed';
  error: string;
};

export type StepSuspended<T> = {
  status: 'suspended';
  payload: T;
};

export type StepResult<T> = StepSuccess<T> | StepFailure | StepSuspended<T>;

export type StepsRecord<T extends readonly Step<any, any, z.ZodObject<any>>[]> = {
  [K in T[number]['id']]: Extract<T[number], { id: K }>;
};

export type PathsToStringProps<T> = T extends object
  ? {
      [K in keyof T]: T[K] extends object
        ? K extends string
          ? K | `${K}.${PathsToStringProps<T[K]>}`
          : never
        : K extends string
          ? K
          : never;
    }[keyof T]
  : never;

export type ExtractSchemaType<T extends z.ZodObject<any>> = T extends z.ZodObject<infer V> ? V : never;

export type ExtractSchemaFromStep<
  TStep extends NewStep<any, any, any>,
  TKey extends 'inputSchema' | 'outputSchema',
> = TStep[TKey];

export type VariableReference<TStep extends NewStep<string, any, any>> = {
  step: TStep;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.';
};

export type WatchEvent = {
  type: 'watch';
  payload: {
    currentStep: {
      id: string;
      status: 'running' | 'completed' | 'failed' | 'suspended';
    };
    workflowState: {
      status: 'running' | 'completed' | 'failed' | 'suspended';
      steps: Record<
        string,
        {
          status: 'running' | 'completed' | 'failed' | 'suspended';
          output?: Record<string, any>;
          payload?: Record<string, any>;
        }
      >;
      output?: Record<string, any>;
      payload?: Record<string, any>;
    };
    eventTimestamp: Date;
  };
};
