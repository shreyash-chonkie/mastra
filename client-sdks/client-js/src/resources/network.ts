import type { ClientOptions, GetNetworkResponse, NetworkGenerateParams, NetworkStreamParams } from '../types';
import { BaseResource } from './base';

export class Network extends BaseResource {
  constructor(
    options: ClientOptions,
    private networkId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the network
   * @returns Promise containing network details including agents and routing model
   */
  details(): Promise<GetNetworkResponse> {
    return this.request(`/api/networks/${this.networkId}`);
  }

  /**
   * Generates a response from the network
   * @param params - Parameters for generation including input
   * @returns Promise containing the generated response
   */
  generate(params: NetworkGenerateParams): Promise<any> {
    return this.request(`/api/networks/${this.networkId}/generate`, {
      method: 'POST',
      body: {
        input: params.input,
      },
    });
  }

  /**
   * Streams a response from the network
   * @param params - Parameters for streaming including input
   * @returns ReadableStream of network response chunks
   */
  async stream(params: NetworkStreamParams): Promise<ReadableStream> {
    const response = await this.request<Response>(`/api/networks/${this.networkId}/stream`, {
      method: 'POST',
      body: {
        input: params.input,
      },
      stream: true,
    });

    return response.body as ReadableStream;
  }

  /**
   * Creates a stream reader for network responses
   * @param params - Parameters for streaming including input
   * @returns AsyncGenerator yielding network response chunks
   */
  async *streamReader(params: NetworkStreamParams): AsyncGenerator<any, void, unknown> {
    const stream = await this.stream(params);
    const reader = stream.getReader();

    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk
          .split('\n')
          .filter(Boolean)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return line;
            }
          });

        for (const line of lines) {
          yield line;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
