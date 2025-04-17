import { openai } from '@ai-sdk/openai';
import type { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCode, TaskState } from '../a2a/types';
import type { A2ARequest, CancelTaskRequest, GetTaskRequest, SendTaskRequest } from '../a2a/types';
import { handleA2ARequest, handleSendTask, handleGetTask, handleCancelTask, handleAgentCardRequest } from './a2a';
import { MockAgent } from './test-utils';

describe('A2A Protocol Handlers', () => {
  let mockAgent: Agent;

  beforeEach(() => {
    // Create a mock agent for testing
    mockAgent = new MockAgent({
      name: 'test-agent',
      instructions: 'test instructions',
      model: openai('gpt-4o'),
    });

    // Reset mocks between tests
    vi.resetAllMocks();
  });

  describe('handleSendTask', () => {
    it('should process a task and return a success response', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'test-id-1',
        method: 'tasks/send',
        params: {
          id: 'task-123',
          message: {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Hello, agent!',
              },
            ],
          },
          sessionId: 'session-123',
        },
      };

      (mockAgent.generate as any).mockResolvedValue({ text: 'Agent response' });

      const response = await handleSendTask(request as SendTaskRequest, mockAgent);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-1');
      expect(response.result).toBeDefined();
      expect(response.result.id).toBe('task-123');
      expect(response.result.sessionId).toBe('session-123');
      expect(response.result.status.state).toBe(TaskState.COMPLETED);
      expect(mockAgent.generate).toHaveBeenCalled();
    });

    it('should handle errors during task processing', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'test-id-2',
        method: 'tasks/send',
        params: {
          id: 'task-456',
          message: {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Hello, agent!',
              },
            ],
          },
        },
      };

      (mockAgent.generate as any).mockRejectedValue(new Error('Processing error'));

      const response = await handleSendTask(request as SendTaskRequest, mockAgent);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-2');
      expect(response.error).toBeDefined();
      expect(response?.error?.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(response?.error?.message).toBe('Internal error processing task');
    });
  });

  describe('handleGetTask', () => {
    it('should return a task if it exists', async () => {
      // First create a task
      const sendRequest = {
        jsonrpc: '2.0',
        id: 'test-id-3',
        method: 'tasks/send',
        params: {
          id: 'task-789',
          message: {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Create a task',
              },
            ],
          },
        },
      };

      (mockAgent.generate as any).mockResolvedValue({ text: 'Task created' });
      await handleSendTask(sendRequest as SendTaskRequest, mockAgent);

      // Now get the task
      const getRequest = {
        jsonrpc: '2.0',
        id: 'test-id-4',
        method: 'tasks/get',
        params: {
          id: 'task-789',
        },
      };

      const response = await handleGetTask(getRequest as GetTaskRequest);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-4');
      expect(response.result).toBeDefined();
      expect(response.result.id).toBe('task-789');
      expect(response.result.status.state).toBe(TaskState.COMPLETED);
    });

    it('should return an error if the task does not exist', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'test-id-5',
        method: 'tasks/get',
        params: {
          id: 'non-existent-task',
        },
      };

      const response = await handleGetTask(request as GetTaskRequest);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-5');
      expect(response.error).toBeDefined();
      expect(response?.error?.code).toBe(ErrorCode.TASK_NOT_FOUND);
      expect(response?.error?.message).toBe('Task not found');
    });

    it('should limit history if historyLength is specified', async () => {
      // First create a task with multiple messages
      const sendRequest = {
        jsonrpc: '2.0',
        id: 'test-id-6',
        method: 'tasks/send',
        params: {
          id: 'task-history',
          message: {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Message 1',
              },
            ],
          },
        },
      };

      (mockAgent.generate as any).mockResolvedValue('Response 1');
      await handleSendTask(sendRequest as SendTaskRequest, mockAgent);

      // Send another message to the same task
      sendRequest.id = 'test-id-7';
      sendRequest.params.message.parts[0].text = 'Message 2';
      (mockAgent.generate as any).mockResolvedValue('Response 2');
      await handleSendTask(sendRequest as SendTaskRequest, mockAgent);

      // Now get the task with limited history
      const getRequest = {
        jsonrpc: '2.0',
        id: 'test-id-8',
        method: 'tasks/get',
        params: {
          id: 'task-history',
          historyLength: 1,
        },
      };

      const response = await handleGetTask(getRequest as GetTaskRequest);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-8');
      expect(response.result).toBeDefined();
      expect(response.result.id).toBe('task-history');
      expect(response.result.history.length).toBe(1);
    });
  });

  describe('handleCancelTask', () => {
    it('should return an error when attempting to cancel a task', async () => {
      // Create a task request
      const sendRequest = {
        jsonrpc: '2.0' as const,
        id: 'request-id',
        method: 'tasks/send' as const,
        params: {
          id: 'task-in-progress',
          message: {
            role: 'user' as const,
            parts: [
              {
                type: 'text' as const,
                text: 'This is a task in progress',
              },
            ],
          },
        },
      };

      // First, let's create the task with the send request
      await handleSendTask(sendRequest, mockAgent);

      // Now attempt to cancel the task
      const cancelRequest = {
        jsonrpc: '2.0' as const,
        id: 'test-id-10',
        method: 'tasks/cancel' as const,
        params: {
          id: 'task-in-progress',
        },
      };

      const response = await handleCancelTask(cancelRequest as CancelTaskRequest);
      console.log(response);
      // Verify we get the expected error response
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-10');
      expect(response.error).toBeDefined();
      expect(response?.error?.code).toBe(ErrorCode.TASK_NOT_CANCELABLE);
      expect(response?.error?.message).toBe('Task cannot be canceled');
      expect(response.result).toBeUndefined();
    });

    it('should return an error if the task does not exist', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'test-id-11',
        method: 'tasks/cancel',
        params: {
          id: 'non-existent-task',
        },
      };

      const response = await handleCancelTask(request as CancelTaskRequest);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-11');
      expect(response.error).toBeDefined();
      expect(response?.error?.code).toBe(ErrorCode.TASK_NOT_FOUND);
      expect(response?.error?.message).toBe('Task not found');
    });

    it('should return an error if the task cannot be canceled', async () => {
      // First create a completed task
      const sendRequest = {
        jsonrpc: '2.0',
        id: 'test-id-12',
        method: 'tasks/send',
        params: {
          id: 'completed-task',
          message: {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Quick task',
              },
            ],
          },
        },
      };

      (mockAgent.generate as any).mockResolvedValue({ text: 'Done quickly' });
      await handleSendTask(sendRequest as SendTaskRequest, mockAgent);

      // Now try to cancel the completed task
      const cancelRequest = {
        jsonrpc: '2.0',
        id: 'test-id-13',
        method: 'tasks/cancel',
        params: {
          id: 'completed-task',
        },
      };

      const response = await handleCancelTask(cancelRequest as CancelTaskRequest);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-13');
      expect(response.error).toBeDefined();
      expect(response?.error?.code).toBe(ErrorCode.TASK_NOT_CANCELABLE);
      expect(response?.error?.message).toBe('Task cannot be canceled');
    });
  });

  describe('handleA2ARequest', () => {
    it('should route to the correct handler based on method', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'test-id-14',
        method: 'tasks/send',
        params: {
          id: 'router-task',
          message: {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Route me',
              },
            ],
          },
        },
      };

      (mockAgent.generate as any).mockResolvedValue({ text: 'Routed successfully' });
      const response = await handleA2ARequest(request as A2ARequest, mockAgent);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-14');
      expect(response.result).toBeDefined();
      expect(response.result.id).toBe('router-task');
      expect(response.result.status.state).toBe(TaskState.COMPLETED);
    });

    it('should return an error for unknown methods', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'test-id-15',
        method: 'unknown/method',
        params: {},
      };

      const response = await handleA2ARequest(request as A2ARequest, mockAgent);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-id-15');
      expect(response.error).toBeDefined();
      expect(response?.error?.code).toBe(ErrorCode.METHOD_NOT_FOUND);
      expect(response?.error?.message).toBe('Method not found');
    });
  });

  describe('handleAgentCardRequest', () => {
    it('should generate an agent card with the correct properties', () => {
      const baseUrl = 'https://example.com';
      const agentCard = handleAgentCardRequest(mockAgent, baseUrl);

      expect(agentCard.name).toBe('test-agent');
      expect(agentCard.description).toBe('test instructions');
      expect(agentCard.url).toBe('https://example.com/a2a');
      expect(agentCard.version).toBeDefined();
      expect(agentCard.capabilities).toBeDefined();
      expect(agentCard.skills).toBeDefined();
      expect(agentCard.skills.length).toBeGreaterThan(0);
    });

    it('should include agent tools as skills', () => {
      // Create an agent with tools
      const agentWithTools = new MockAgent({
        name: 'tool-agent',
        instructions: 'agent with tools',
        model: openai('gpt-4o'),
        tools: {
          calculator: createTool({
            id: 'Calculator',
            description: 'Performs calculations',
            execute: async () => {
              return 'Calculator executed';
            },
          }),
          weather: createTool({
            id: 'Weather',
            description: 'Gets weather information',
            execute: async () => {
              return 'Weather executed';
            },
          }),
        },
      });

      const baseUrl = 'https://example.com';
      const agentCard = handleAgentCardRequest(agentWithTools, baseUrl);

      console.log(agentCard);

      expect(agentCard.skills.length).toBeGreaterThanOrEqual(2);

      // Find the calculator skill
      const calculatorSkill = agentCard.skills.find(skill => skill.id === 'calculator');
      expect(calculatorSkill).toBeDefined();
      expect(calculatorSkill?.name).toBe('Calculator');
      expect(calculatorSkill?.description).toBe('Performs calculations');

      // Find the weather skill
      const weatherSkill = agentCard.skills.find(skill => skill.id === 'weather');
      expect(weatherSkill).toBeDefined();
      expect(weatherSkill?.name).toBe('Weather');
      expect(weatherSkill?.description).toBe('Gets weather information');
    });
  });
});
