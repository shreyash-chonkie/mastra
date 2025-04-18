import type {
  A2AMessage,
  A2ARequest,
  AgentCard,
  CancelTaskRequest,
  GetTaskRequest,
  JSONRPCResponse,
  SendTaskRequest,
  Task,
} from '../types';
import { BaseResource } from './base';

/**
 * A2A Protocol resource for agent-to-agent communication
 */
export class A2A extends BaseResource {
  /**
   * Sends an A2A protocol request to the server
   * @param request - The A2A protocol request
   * @returns Promise containing the A2A protocol response
   */
  public sendRequest(request: A2ARequest): Promise<JSONRPCResponse> {
    return this.request('/api/a2a', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Sends a task to an agent using the A2A protocol
   * @param params - Parameters for sending the task
   * @returns Promise containing the task
   */
  public sendTask(params: { id: string; message: A2AMessage; sessionId?: string }): Promise<Task> {
    const request: SendTaskRequest = {
      jsonrpc: '2.0',
      id: `send-${Date.now()}`,
      method: 'tasks/send',
      params,
    };

    return this.sendRequest(request).then(response => {
      if ('error' in response) {
        throw new Error(response.error.message);
      }
      return response.result as Task;
    });
  }

  /**
   * Gets a task by ID using the A2A protocol
   * @param params - Parameters for getting the task
   * @returns Promise containing the task
   */
  public getTask(params: { id: string; historyLength?: number }): Promise<Task> {
    const request: GetTaskRequest = {
      jsonrpc: '2.0',
      id: `get-${Date.now()}`,
      method: 'tasks/get',
      params,
    };

    return this.sendRequest(request).then(response => {
      if ('error' in response) {
        throw new Error(response.error.message);
      }
      return response.result as Task;
    });
  }

  /**
   * Cancels a task by ID using the A2A protocol
   * @param params - Parameters for canceling the task
   * @returns Promise containing the task
   */
  public cancelTask(params: { id: string }): Promise<Task> {
    const request: CancelTaskRequest = {
      jsonrpc: '2.0',
      id: `cancel-${Date.now()}`,
      method: 'tasks/cancel',
      params,
    };

    return this.sendRequest(request).then(response => {
      if ('error' in response) {
        throw new Error(response.error.message);
      }
      return response.result as Task;
    });
  }

  /**
   * Gets the agent card for the A2A protocol
   * @returns Promise containing the agent card
   */
  public getAgentCard(): Promise<AgentCard> {
    return this.request('/api/a2a/agent-card');
  }
}
