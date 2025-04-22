import { BaseResource } from './base';
import type { ClientOptions } from '../types';

// Optionally, define types for the A2A agent card responses
export interface A2AAgentCard {
  name: string;
  description: string;
  url: string;
  provider: string;
  version: string;
  [key: string]: any;
}

export interface ListA2AResponse {
  agents: A2AAgentCard[];
  count: number;
}

export class A2A extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  /**
   * Get all agent cards (A2A protocol)
   * @returns List of agent cards and count
   */
  list(): Promise<ListA2AResponse> {
    return this.request('/api/a2a');
  }

  /**
   * Get a specific agent card by ID (A2A protocol)
   * @param agentId - The agent's ID
   * @returns Agent card details
   */
  details(agentId: string): Promise<A2AAgentCard> {
    return this.request(`/api/a2a/${agentId}`);
  }
}
