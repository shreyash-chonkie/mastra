import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createCohere } from '@ai-sdk/cohere';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import {
  CoreMessage,
  CoreTool as CT,
  generateObject,
  generateText,
  jsonSchema,
  LanguageModelV1,
  Schema,
  streamObject,
  streamText,
  tool,
} from 'ai';
import { createAnthropicVertex } from 'anthropic-vertex-ai';
import { JSONSchema7 } from 'json-schema';
import { z, ZodSchema } from 'zod';

import 'dotenv/config';

import { MastraPrimitives } from '../action';
import { ToolsInput } from '../agent/types';
import { MastraBase } from '../base';
import { LogLevel, RegisteredLogger } from '../logger';
import { InstrumentClass } from '../telemetry/telemetry.decorators';
import { CoreTool } from '../tools/types';
import { delay } from '../utils';

import {
  CustomModelConfig,
  GenerateReturn,
  GoogleGenerativeAISettings,
  LLMInnerStreamOptions,
  LLMProvider,
  LLMStreamObjectOptions,
  LLMStreamOptions,
  LLMTextObjectOptions,
  LLMTextOptions,
  ModelConfig,
  StreamReturn,
} from './types';

@InstrumentClass({
  prefix: 'llm',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export class LLM extends MastraBase {
  #model: ModelConfig;
  #mastra: MastraPrimitives;

  constructor({ model }: { model: ModelConfig }) {
    super({
      component: RegisteredLogger.LLM,
    });
    this.#model = model;
    this.#mastra = {} as MastraPrimitives;
  }

  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }

    this.#mastra = p;
  }

  getModelType(): string {
    const model = this.#model;

    if (!('provider' in model)) {
      throw new Error('Model provider is required');
    }
    const providerToType: Record<LLMProvider, string> = {
      OPEN_AI: 'openai',
      ANTHROPIC: 'anthropic',
      GROQ: 'groq',
      PERPLEXITY: 'perplexity',
      FIREWORKS: 'fireworks',
      TOGETHER_AI: 'togetherai',
      LM_STUDIO: 'lmstuido',
      BASETEN: 'baseten',
      GOOGLE: 'google',
      MISTRAL: 'mistral',
      X_GROK: 'grok',
      COHERE: 'cohere',
      AZURE: 'azure',
      AMAZON: 'amazon',
      ANTHROPIC_VERTEX: 'anthropic-vertex',
      DEEPSEEK: 'deepseek',
    };
    const type = providerToType[model.provider as LLMProvider] ?? model.provider;

    this.logger.debug(`[LLM] - Model resolved to provider ${model.provider}`, {
      sdk_type: type,
      provider: model.provider,
    });

    return type;
  }

  createOpenAICompatibleModel({
    baseURL,
    apiKey,
    defaultModelName,
    modelName,
    fetch,
  }: {
    baseURL: string;
    apiKey: string;
    defaultModelName: string;
    modelName?: string;
    fetch?: typeof globalThis.fetch;
  }): LanguageModelV1 {
    this.log(LogLevel.DEBUG, `Creating OpenAI compatible model with baseURL: ${baseURL}`);
    const client = createOpenAI({
      baseURL,
      apiKey,
      fetch,
    });
    return client(modelName || defaultModelName);
  }

  createModelDef({
    model,
  }: {
    model: {
      type: string;
      name?: string;
      toolChoice?: 'auto' | 'required';
      baseURL?: string;
      fetch?: typeof globalThis.fetch;
      apiVersion?: string;
      headers?: Record<string, string>;
      apiKey?: string;
    };
  }): LanguageModelV1 {
    let modelDef: LanguageModelV1;
    if (model.type === 'groq') {
      this.log(LogLevel.DEBUG, `Initializing Groq model ${model.name || 'llama-3.2-90b-text-preview'}`);
      modelDef = this.createOpenAICompatibleModel({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: model?.apiKey || process.env.GROQ_API_KEY || '',
        defaultModelName: 'llama-3.2-90b-text-preview',
        modelName: model.name,
      });
    } else if (model.type === 'perplexity') {
      this.log(LogLevel.DEBUG, `Initializing Perplexity model ${model.name || 'llama-3.1-sonar-large-128k-chat'}`);
      modelDef = this.createOpenAICompatibleModel({
        baseURL: 'https://api.perplexity.ai/',
        apiKey: model?.apiKey || process.env.PERPLEXITY_API_KEY || '',
        defaultModelName: 'llama-3.1-sonar-large-128k-chat',
        modelName: model.name,
      });
    } else if (model.type === 'fireworks') {
      this.log(LogLevel.DEBUG, `Initializing Fireworks model ${model.name || 'llama-v3p1-70b-instruct'}`);
      modelDef = this.createOpenAICompatibleModel({
        baseURL: 'https://api.fireworks.ai/inference/v1',
        apiKey: model?.apiKey || process.env.FIREWORKS_API_KEY || '',
        defaultModelName: 'llama-v3p1-70b-instruct',
        modelName: model.name,
      });
    } else if (model.type === 'togetherai') {
      this.log(LogLevel.DEBUG, `Initializing TogetherAI model ${model.name || 'google/gemma-2-9b-it'}`);
      modelDef = this.createOpenAICompatibleModel({
        baseURL: 'https://api.together.xyz/v1/',
        apiKey: model?.apiKey || process.env.TOGETHER_AI_API_KEY || '',
        defaultModelName: 'google/gemma-2-9b-it',
        modelName: model.name,
      });
    } else if (model.type === 'lmstudio') {
      this.log(LogLevel.DEBUG, `Initializing LMStudio model ${model.name || 'llama-3.2-1b'}`);

      if (!model?.baseURL) {
        const error = `LMStudio model requires a baseURL`;
        this.logger.error(error);
        throw new Error(error);
      }
      modelDef = this.createOpenAICompatibleModel({
        baseURL: model.baseURL,
        apiKey: 'not-needed',
        defaultModelName: 'llama-3.2-1b',
        modelName: model.name,
      });
    } else if (model.type === 'baseten') {
      this.log(LogLevel.DEBUG, `Initializing BaseTen model ${model.name || 'llama-3.1-70b-instruct'}`);
      if (model?.fetch) {
        const error = `Custom fetch is required to use ${model.type}. see https://docs.baseten.co/api-reference/openai for more information`;
        this.logger.error(error);
        throw new Error(error);
      }
      modelDef = this.createOpenAICompatibleModel({
        baseURL: 'https://bridge.baseten.co/v1/direct',
        apiKey: model?.apiKey || process.env.BASETEN_API_KEY || '',
        defaultModelName: 'llama-3.1-70b-instruct',
        modelName: model.name,
      });
    } else if (model.type === 'mistral') {
      this.log(LogLevel.DEBUG, `Initializing Mistral model ${model.name || 'pixtral-large-latest'}`);
      const mistral = createMistral({
        baseURL: 'https://api.mistral.ai/v1',
        apiKey: model?.apiKey || process.env.MISTRAL_API_KEY || '',
      });

      modelDef = mistral(model.name || 'pixtral-large-latest');
    } else if (model.type === 'grok') {
      this.log(LogLevel.DEBUG, `Initializing X Grok model ${model.name || 'grok-beta'}`);
      const xAi = createXai({
        baseURL: 'https://api.x.ai/v1',
        apiKey: process.env.XAI_API_KEY ?? '',
      });

      modelDef = xAi(model.name || 'grok-beta');
    } else {
      const error = `Invalid model type: ${model.type}`;
      this.logger.error(error);
      throw new Error(error);
    }

    return modelDef;
  }

  async getParams({
    tools,
    resultTool,
    model,
  }: {
    tools: Record<string, CoreTool>;
    resultTool?: { description: string; parameters: ZodSchema };
    model:
      | ({
          type: string;
          name?: string;
          toolChoice?: 'auto' | 'required';
          baseURL?: string;
          apiKey?: string;
          apiVersion?: string;
          headers?: Record<string, string>;
          fetch?: typeof globalThis.fetch;
        } & GoogleGenerativeAISettings)
      | CustomModelConfig;
  }) {
    const toolsConverted = Object.entries(tools).reduce(
      (memo, [key, val]) => {
        memo[key] = tool(val);
        return memo;
      },
      {} as Record<string, CT>,
    );

    let answerTool = {};
    if (resultTool) {
      answerTool = { answer: tool(resultTool) };
    }

    let modelDef;

    if ('type' in model) {
      modelDef = this.createModelDef({ model });
    } else {
      if (model.model instanceof Function) {
        modelDef = await model.model();
      } else {
        modelDef = model.model;
      }
    }

    return {
      toolsConverted,
      modelDef,
      answerTool,
      toolChoice: model.toolChoice || 'auto',
    };
  }

  __getNamedModel() {
    const model = this.#model;

    if (!('name' in model)) {
      throw new Error('Model name is required');
    }

    return {
      type: this.getModelType(),
      name: model.name,
      toolChoice: model.toolChoice,
      apiKey: model?.apiKey,
      baseURL: model?.baseURL,
      headers: model?.headers,
      fetch: model?.fetch,
    };
  }
}
