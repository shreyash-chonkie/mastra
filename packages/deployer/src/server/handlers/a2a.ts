import type { Mastra } from '@mastra/core';
import {
  handleA2ARequest as originalHandleA2ARequest,
  handleAgentCardRequest as originalHandleAgentCardRequest,
} from '@mastra/server/handlers/a2a';
import type { Context } from 'hono';

import { handleError } from './error';

/**
 * Handle A2A protocol requests
 */
export async function handleA2ARequestEndpoint(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agents = mastra.getAgents();
    const agent = Object.values(agents)[0]; // Get the first available agent

    if (!agent) {
      return c.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'No agent available',
          },
        },
        500,
      );
    }

    const body = await c.req.json();
    const response = await originalHandleA2ARequest(body, agent);
    return c.json(response);
  } catch (error) {
    return handleError(error, 'Error handling A2A request');
  }
}

/**
 * Handle agent card requests
 */
export async function handleAgentCardEndpoint(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agents = mastra.getAgents();
    const agent = Object.values(agents)[0]; // Get the first available agent

    if (!agent) {
      return c.json({ error: 'No agent available' }, 500);
    }

    const baseUrl = `${c.req.url.split('/api/')[0]}`;
    const agentCard = originalHandleAgentCardRequest(agent, baseUrl);
    return c.json(agentCard);
  } catch (error) {
    return handleError(error, 'Error handling agent card request');
  }
}
