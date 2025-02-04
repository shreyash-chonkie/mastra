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
  LanguageModelV1,
  StreamObjectResult,
  StreamTextResult,
  Tool as CT,
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

export type BasetenModel =
  | 'llama-3.1-70b-instruct'
  | 'qwen2.5-7b-math-instruct'
  | 'qwen2.5-14b-instruct'
  | 'qwen2.5-32b-coder-instruct'
  | 'llama-3.1-8b-instruct'
  | 'llama-3.1-nemetron-70b'
  | 'llama-3.2-90b-vision-instruct'
  | 'llama-3.1-405b-instruct'
  | 'ultravox-v0.4'
  | 'llama-3.2-1b-vision-instruct'
  | 'llama-3-70b-instruct'
  | 'llama-3-8b-instruct'
  | 'mistral-7b-instruct'
  | 'qwen2.5-14b-coder-instruct'
  | 'qwen2.5-7b-coder-instruct'
  | 'qwen2.5-72b-math-instruct'
  | 'qwen2.5-72b-instruct'
  | 'qwen2.5-32b-instruct'
  | 'qwen2.5-7b-instruct'
  | 'qwen2.5-3b-instruct'
  | 'pixtral-12b'
  | 'phi-3.5-mini-instruct'
  | 'gemma-2-9b'
  | 'gemma-2-27b'
  | 'phi-3-mini-128k-instruct'
  | 'phi-3-mini-4k-instruct'
  | 'zephyr-7b-alpha'
  | 'mixtral-8x7b-instruct'
  | 'mixtral-8x22b';

export type BaseTenConfig = {
  provider: 'BASETEN';
  name: BasetenModel | (string & {});
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export type CustomModelConfig = {
  model: LanguageModelV1 | (() => Promise<LanguageModelV1>);
  provider: string;
  apiKey?: string;
  toolChoice?: 'auto' | 'required';
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

type BuiltInModelConfig = BaseTenConfig;

export type ModelConfig = BuiltInModelConfig | CustomModelConfig;

export type LLMProvider = BuiltInModelConfig['provider'];

export type BaseStructuredOutputType = 'string' | 'number' | 'boolean' | 'date';

export type StructuredOutputType = 'array' | 'string' | 'number' | 'object' | 'boolean' | 'date';

export type StructuredOutputArrayItem =
  | {
      type: BaseStructuredOutputType;
    }
  | {
      type: 'object';
      items: StructuredOutput;
    };

export type StructuredOutput = {
  [key: string]:
    | {
        type: BaseStructuredOutputType;
      }
    | {
        type: 'object';
        items: StructuredOutput;
      }
    | {
        type: 'array';
        items: StructuredOutputArrayItem;
      };
};

export type GenerateReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? GenerateTextResult<any, any>
  : GenerateObjectResult<any>;

export type StreamReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? StreamTextResult<any, any>
  : StreamObjectResult<any, any, any>;

export type OutputType = 'text' | StructuredOutput;

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
} & Run;

export type LLMTextObjectOptions<T> = LLMTextOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
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
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
};

export type GenerateTextInputOptions = {
  runId?: string;
  messages: CoreMessage[];
  maxSteps?: number;
  tools?: ToolsInput;
  convertedTools?: Record<string, CT>;
  temperature?: number;
  toolChoice?: 'required' | 'auto';
  onStepFinish?: (step: string) => void;
};

export type GenerateStreamInputOptions = {
  messages: CoreMessage[];
  onFinish?: (step: string) => void;
  maxSteps?: number;
  tools?: ToolsInput;
  toolChoice?: 'required' | 'auto';
  convertedTools?: Record<string, CT>;
  runId?: string;
  temperature?: number;
  onStepFinish?: (step: string) => void;
};
