import type { Mastra } from '@mastra/core';
import {
  getMcpServersHandler as getOriginalMcpServersHandler,
  getMcpServerHandler as getOriginalMcpServerHandler,
} from '@mastra/server/handlers/mcp';
import type { Context } from 'hono';

// Helper function to get the Mastra instance from the context
const getMastra = (c: Context): Mastra => c.get('mastra');

/**
 * Handler for GET /api/mcp/servers
 * Lists all MCP servers registered on the Mastra instance
 */
export const getMcpServersHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const result = await getOriginalMcpServersHandler({ mastra });
  return c.json(result);
};

/**
 * Handler for GET /api/mcp/servers/:serverId
 * Returns details about a specific MCP server
 */
export const getMcpServerHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');

  try {
    const result = await getOriginalMcpServerHandler({ mastra, serverId });
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message || 'Server not found' }, 404);
  }
};

/**
 * Handler for POST /api/mcp/servers/:serverId
 */
export const mcpServerSseHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');

  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server '${serverId}' not found` }, 404);
  }
};
