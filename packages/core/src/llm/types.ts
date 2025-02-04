import {
  CoreAssistantMessage as AiCoreAssistantMessage,
  CoreMessage as AiCoreMessage,
  CoreSystemMessage as AiCoreSystemMessage,
  CoreToolMessage as AiCoreToolMessage,
  CoreUserMessage as AiCoreUserMessage,
  EmbedManyResult as AiEmbedManyResult,
  EmbedResult as AiEmbedResult,
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
} from 'ai';
import { JSONSchema7 } from 'json-schema';
import { z, ZodSchema } from 'zod';

import { ToolsInput } from '../agent/types';
import { Run } from '../run/types';
import { CoreTool } from '../tools/types';

export type CoreMessage = AiCoreMessage;

export type CoreSystemMessage = AiCoreSystemMessage;

export type CoreAssistantMessage = AiCoreAssistantMessage;

export type CoreUserMessage = AiCoreUserMessage;

export type CoreToolMessage = AiCoreToolMessage;

export type EmbedResult<T> = AiEmbedResult<T>;

export type EmbedManyResult<T> = AiEmbedManyResult<T>;
export interface GoogleGenerativeAISettings {
  /**
  Optional.
  The name of the cached content used as context to serve the prediction.
  Format: cachedContents/{cachedContent}
     */
  cachedContent?: string;
  /**
   * Optional. Enable structured output. Default is true.
   *
   * This is useful when the JSON Schema contains elements that are
   * not supported by the OpenAPI schema version that
   * Google Generative AI uses. You can use this to disable
   * structured outputs if you need to.
   */
  structuredOutputs?: boolean;
  /**
  Optional. A list of unique safety settings for blocking unsafe content.
     */
  safetySettings?: Array<{
    category:
    | 'HARM_CATEGORY_HATE_SPEECH'
    | 'HARM_CATEGORY_DANGEROUS_CONTENT'
    | 'HARM_CATEGORY_HARASSMENT'
    | 'HARM_CATEGORY_SEXUALLY_EXPLICIT';
    threshold:
    | 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
    | 'BLOCK_LOW_AND_ABOVE'
    | 'BLOCK_MEDIUM_AND_ABOVE'
    | 'BLOCK_ONLY_HIGH'
    | 'BLOCK_NONE';
  }>;
}

export type GenerateReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? GenerateTextResult<any, any>
  : GenerateObjectResult<any>;

export type StreamReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? StreamTextResult<any, any>
  : StreamObjectResult<any, any, any>;

export type OutputType = 'text'

export type LLMStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  runId?: string;
  onFinish?: (result: string) => Promise<void> | void;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  output?: OutputType | Z;
  temperature?: number;
};

export type LLMTextOptions = {
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  messages: CoreMessage[];
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  temperature?: number;
  toolChoice?: 'auto' | 'required';
} & Run;

export type LLMTextObjectOptions<T> = LLMTextOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T>;
};

export type LLMInnerStreamOptions = {
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  messages: CoreMessage[];
  onStepFinish?: (step: string) => void;
  onFinish?: (result: string) => Promise<void> | void;
  maxSteps?: number;
  temperature?: number;
} & Run;

export type LLMStreamObjectOptions<T> = LLMInnerStreamOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T>;
};