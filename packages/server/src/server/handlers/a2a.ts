import type { Agent } from '@mastra/core/agent';
import type {
  A2ARequest,
  AgentCard,
  AgentCapabilities,
  AgentSkill,
  JSONRPCResponse,
  Message,
  Part,
  SendTaskRequest,
  GetTaskRequest,
  CancelTaskRequest,
  Task,
} from '../a2a/types';

import { ErrorCode, TaskState } from '../a2a/types';

// In-memory storage for tasks (in a production environment, this would be a database)
const tasks = new Map<string, Task>();

/**
 * Convert an agent message to A2A message format
 */
function convertToA2AMessage(message: any, role: 'user' | 'agent'): Message {
  // Simple conversion for text messages
  if (typeof message === 'string') {
    return {
      role,
      parts: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }

  // Handle more complex message formats
  // This is a simplified implementation and would need to be expanded
  // based on the actual message format used in Mastra
  let parts: Part[] = [];

  if (message && message.content) {
    if (typeof message.content === 'string') {
      parts.push({
        type: 'text',
        text: message.content,
      });
    } else if (Array.isArray(message.content)) {
      parts = message.content.map((item: any) => {
        if (typeof item === 'string') {
          return {
            type: 'text',
            text: item,
          };
        } else if (item && item.type === 'text') {
          return {
            type: 'text',
            text: item.text || '',
          };
        } else if (item && item.type === 'file') {
          return {
            type: 'file',
            file: {
              name: item.name || null,
              mimeType: item.mimeType || null,
              uri: item.uri || null,
            },
          };
        } else {
          return {
            type: 'data',
            data: item || {},
          };
        }
      });
    }
  }

  return {
    role,
    parts,
  };
}

/**
 * Convert A2A message format to agent message
 */
function convertFromA2AMessage(message: Message): any {
  // Simple conversion for text-only messages
  if (message.parts && message.parts.length === 1 && message.parts[0]?.type === 'text') {
    return message.parts[0]?.text || '';
  }

  // Handle more complex message formats
  // This is a simplified implementation and would need to be expanded
  // based on the actual message format used in Mastra
  const content = (message.parts || [])
    .map(part => {
      if (part.type === 'text') {
        return part.text || '';
      } else if (part.type === 'file' && part.file) {
        return {
          type: 'file',
          name: part.file.name || '',
          mimeType: part.file.mimeType || '',
          uri: part.file.uri || '',
        };
      } else if (part.type === 'data') {
        return part.data || {};
      }
      return null;
    })
    .filter(Boolean);

  return {
    role: message.role || 'user',
    content: content.length === 1 ? content[0] : content,
  };
}

/**
 * Create a JSON-RPC error response
 */
function createErrorResponse(
  id: string | number | null,
  code: ErrorCode,
  message: string,
  data?: any,
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

/**
 * Create a JSON-RPC success response
 */
function createSuccessResponse(id: string | number | null, result: any): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Handle a tasks/send request
 */
export async function handleSendTask(request: SendTaskRequest, agent: Agent): Promise<JSONRPCResponse> {
  try {
    const { id, message, sessionId } = request.params;

    // Convert the A2A message to the format expected by the agent
    const agentMessage = convertFromA2AMessage(message);

    // Process the message with the agent
    // Note: We're using any here because Agent interface might vary
    const response = await (agent as any).generate(agentMessage);

    // Convert the agent response to A2A format
    const a2aResponse = convertToA2AMessage(response, 'agent');

    // Create or update the task
    const now = new Date().toISOString();
    const task: Task = {
      id,
      sessionId: sessionId || null,
      status: {
        state: TaskState.COMPLETED,
        message: a2aResponse,
        timestamp: now,
      },
      history: [message, a2aResponse],
    };

    // Store the task
    tasks.set(id, task);

    return createSuccessResponse(request.id || null, task);
  } catch (error) {
    console.error('Error handling send task:', error);
    return createErrorResponse(request.id || null, ErrorCode.INTERNAL_ERROR, 'Internal error processing task', {
      error: String(error),
    });
  }
}

/**
 * Handle a tasks/get request
 */
export async function handleGetTask(request: GetTaskRequest): Promise<JSONRPCResponse> {
  try {
    const { id, historyLength } = request.params;

    // Get the task from storage
    const task = tasks.get(id);

    if (!task) {
      return createErrorResponse(request.id || null, ErrorCode.TASK_NOT_FOUND, 'Task not found');
    }

    // If historyLength is specified, limit the history
    if (historyLength !== undefined && historyLength !== null && task.history) {
      task.history = task.history.slice(-historyLength);
    }

    return createSuccessResponse(request.id || null, task);
  } catch (error) {
    console.error('Error handling get task:', error);
    return createErrorResponse(request.id || null, ErrorCode.INTERNAL_ERROR, 'Internal error retrieving task', {
      error: String(error),
    });
  }
}

/**
 * Handle a tasks/cancel request
 */
export async function handleCancelTask(request: CancelTaskRequest): Promise<JSONRPCResponse> {
  try {
    const { id } = request.params;

    // Get the task from storage
    const task = tasks.get(id);

    if (!task) {
      return createErrorResponse(request.id || null, ErrorCode.TASK_NOT_FOUND, 'Task not found');
    }

    // Check if the task can be canceled
    if (
      task.status.state === TaskState.COMPLETED ||
      task.status.state === TaskState.CANCELED ||
      task.status.state === TaskState.FAILED
    ) {
      return createErrorResponse(request.id || null, ErrorCode.TASK_NOT_CANCELABLE, 'Task cannot be canceled');
    }

    // Update the task status
    task.status = {
      state: TaskState.CANCELED,
      timestamp: new Date().toISOString(),
    };

    // Store the updated task
    tasks.set(id, task);

    return createSuccessResponse(request.id || null, task);
  } catch (error) {
    console.error('Error handling cancel task:', error);
    return createErrorResponse(request.id || null, ErrorCode.INTERNAL_ERROR, 'Internal error canceling task', {
      error: String(error),
    });
  }
}

/**
 * Handle push notification requests
 */
export function handlePushNotification(): JSONRPCResponse {
  // This is a placeholder implementation
  // In a real implementation, this would handle push notification configuration
  return createErrorResponse(null, ErrorCode.PUSH_NOTIFICATION_NOT_SUPPORTED, 'Push Notification is not supported');
}

/**
 * Handle a JSON-RPC request for the A2A protocol
 */
export async function handleA2ARequest(request: A2ARequest, agent: Agent): Promise<JSONRPCResponse> {
  try {
    // Extract the ID safely, ensuring it's treated as a valid ID or null
    const requestId = 'id' in request ? request.id : null;

    switch (request.method) {
      case 'tasks/send':
        return await handleSendTask(request as SendTaskRequest, agent);
      case 'tasks/get':
        return await handleGetTask(request as GetTaskRequest);
      case 'tasks/cancel':
        return await handleCancelTask(request as CancelTaskRequest);
      case 'tasks/pushNotification/set':
      case 'tasks/pushNotification/get':
      case 'tasks/resubscribe':
        return handlePushNotification();
      default:
        return createErrorResponse(requestId!, ErrorCode.METHOD_NOT_FOUND, 'Method not found');
    }
  } catch (error) {
    console.error('Error handling A2A request:', error);
    // Ensure we handle the ID safely to avoid undefined values
    const errorRequestId = 'id' in request && request.id !== undefined ? request.id : null;
    return createErrorResponse(errorRequestId, ErrorCode.INTERNAL_ERROR, 'Internal error', { error: String(error) });
  }
}

/**
 * Generate an agent card for the A2A protocol
 */
export function generateAgentCard(agent: Agent, baseUrl: string): AgentCard {
  // Extract skills from the agent
  const skills: AgentSkill[] = [];

  // If the agent has tools, convert them to skills
  if (agent.tools) {
    Object.entries(agent.tools).forEach(([id, tool]) => {
      // Handle different tool formats
      const toolName = typeof tool === 'object' && tool !== null ? (tool as any).id || id : id;
      const toolDescription = typeof tool === 'object' && tool !== null ? (tool as any).description || null : null;

      skills.push({
        id,
        name: toolName,
        description: toolDescription,
      });
    });
  }

  // If no skills were found, add a default skill
  if (skills.length === 0) {
    skills.push({
      id: 'conversation',
      name: 'Conversation',
      description: 'General conversation capabilities',
    });
  }

  // Define capabilities
  const capabilities: AgentCapabilities = {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  };

  return {
    name: agent.name || 'Mastra Agent',
    description: typeof agent.instructions === 'string' ? agent.instructions : null,
    url: `${baseUrl}/a2a`,
    version: '1.0.0',
    capabilities,
    skills,
  };
}

/**
 * Handle a request for the agent card
 */
export function handleAgentCardRequest(agent: Agent, baseUrl: string): AgentCard {
  return generateAgentCard(agent, baseUrl);
}
