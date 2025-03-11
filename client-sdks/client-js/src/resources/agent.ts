import type { GenerateReturn, StreamReturn } from '@mastra/core';
import type { MastraVoice, SpeechSynthesisAdapter } from '@mastra/core/voice';
import type { JSONSchema7 } from 'json-schema';
import { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type {
  GenerateParams,
  GetAgentResponse,
  GetEvalsByAgentIdResponse,
  GetToolResponse,
  ClientOptions,
  StreamParams,
  GetSpeakerResponse,
  SpeakRequest,
  ListenRequest,
} from '../types';

import { BaseResource } from './base';

export class AgentTool extends BaseResource {
  constructor(
    options: ClientOptions,
    private agentId: string,
    private toolId: string,
  ) {
    super(options);
  }

  /**
   * Executes a specific tool for an agent
   * @param params - Parameters required for tool execution
   * @returns Promise containing tool execution results
   */
  execute(params: { data: any }): Promise<any> {
    return this.request(`/api/agents/${this.agentId}/tools/${this.toolId}/execute`, {
      method: 'POST',
      body: params,
    });
  }
}

export class Agent extends BaseResource {
  constructor(
    options: ClientOptions,
    private agentId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the agent
   * @returns Promise containing agent details including model and instructions
   */
  details(): Promise<GetAgentResponse> {
    return this.request(`/api/agents/${this.agentId}`);
  }

  /**
   * Generates a response from the agent
   * @param params - Generation parameters including prompt
   * @returns Promise containing the generated response
   */
  generate<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: GenerateParams<T>,
  ): Promise<GenerateReturn<T>> {
    const processedParams = {
      ...params,
      output: params.output instanceof ZodSchema ? zodToJsonSchema(params.output) : params.output,
      experimental_output:
        params.experimental_output instanceof ZodSchema
          ? zodToJsonSchema(params.experimental_output)
          : params.experimental_output,
    };

    return this.request(`/api/agents/${this.agentId}/generate`, {
      method: 'POST',
      body: processedParams,
    });
  }

  /**
   * Streams a response from the agent
   * @param params - Stream parameters including prompt
   * @returns Promise containing the streamed response
   */
  stream<T extends JSONSchema7 | ZodSchema | undefined = undefined>(params: StreamParams<T>): Promise<Response> {
    const processedParams = {
      ...params,
      output: params.output instanceof ZodSchema ? zodToJsonSchema(params.output) : params.output,
      experimental_output:
        params.experimental_output instanceof ZodSchema
          ? zodToJsonSchema(params.experimental_output)
          : params.experimental_output,
    };

    return this.request(`/api/agents/${this.agentId}/stream`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    });
  }

  /**
   * Gets details about a specific tool available to the agent
   * @param toolId - ID of the tool to retrieve
   * @returns Promise containing tool details
   */
  getTool(toolId: string): Promise<GetToolResponse> {
    return this.request(`/api/agents/${this.agentId}/tools/${toolId}`);
  }

  /**
   * Retrieves evaluation results for the agent
   * @returns Promise containing agent evaluations
   */
  evals(): Promise<GetEvalsByAgentIdResponse> {
    return this.request(`/api/agents/${this.agentId}/evals/ci`);
  }

  /**
   * Retrieves live evaluation results for the agent
   * @returns Promise containing live agent evaluations
   */
  liveEvals(): Promise<GetEvalsByAgentIdResponse> {
    return this.request(`/api/agents/${this.agentId}/evals/live`);
  }

  /**
   * Retrieves available speakers for the agent
   * @returns Promise containing available speakers
   */
  getSpeakers(): Promise<GetSpeakerResponse> {
    return this.request(`/api/agents/${this.agentId}/speakers`);
  }

  /**
   * Converts text to speech using the agent's voice provider
   * @param params - Parameters including text and speaker ID
   * @returns Promise containing the speech response
   */
  speak(params: SpeakRequest): Promise<NodeJS.ReadableStream> {
    return this.request(`/api/agents/${this.agentId}/speak`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Converts speech to text using the agent's voice provider
   * @param params - Parameters including audio stream
   * @returns Promise containing the text response
   */
  listen(params: ListenRequest): Promise<string | NodeJS.ReadableStream> {
    return this.request(`/api/agents/${this.agentId}/listen`, {
      method: 'POST',
      body: params,
    });
  }

  getSpeechProvider(): Promise<SpeechSynthesisAdapter> {
    return this.request(`/api/agents/${this.agentId}/speech-provider`);
  }
}
