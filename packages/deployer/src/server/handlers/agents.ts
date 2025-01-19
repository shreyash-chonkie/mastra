import { Context } from 'hono';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { ContentfulStatusCode } from 'hono/utils/http-status';

import { ApiError } from '../types';

export async function getAgentsHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const agents = mastra.getAgents();
    const serializedAgents = Object.entries(agents).reduce<any>((acc, [_id, _agent]) => {
      const agent = _agent as any;
      const serializedAgentTools = Object.entries(agent?.tools || {}).reduce<any>((acc, [key, tool]) => {
        const _tool = tool as any;
        acc[key] = {
          ..._tool,
          inputSchema: _tool.inputSchema ? stringify(zodToJsonSchema(_tool.inputSchema)) : undefined,
          outputSchema: _tool.outputSchema ? stringify(zodToJsonSchema(_tool.outputSchema)) : undefined,
        };
        return acc;
      }, {});
      acc[_id] = {
        ...agent,
        tools: serializedAgentTools,
      };
      return acc;
    }, {});
    return c.json(serializedAgents);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agents', apiError);
    return c.json(
      { error: apiError.message || 'Error getting agents' },
      (apiError.status || 500) as ContentfulStatusCode,
    );
  }
}

export async function getAgentHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const agentId = decodeURIComponent(c.req.param('agentId'));
    const agent = mastra.getAgent(agentId);
    const serializedAgentTools = Object.entries(agent?.tools || {}).reduce<any>((acc, [key, tool]) => {
      const _tool = tool as any;
      acc[key] = {
        ..._tool,
        inputSchema: _tool.inputSchema ? stringify(zodToJsonSchema(_tool.inputSchema)) : undefined,
        outputSchema: _tool.outputSchema ? stringify(zodToJsonSchema(_tool.outputSchema)) : undefined,
      };
      return acc;
    }, {});
    return c.json({
      ...agent,
      tools: serializedAgentTools,
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agent', apiError);
    return c.json(
      { error: apiError.message || 'Error getting agent' },
      (apiError.status || 500) as ContentfulStatusCode,
    );
  }
}
