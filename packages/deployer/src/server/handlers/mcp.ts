import type { Mastra } from '@mastra/core';
import {
  getMcpServersHandler as getOriginalMcpServersHandler,
  getMcpServerHandler as getOriginalMcpServerHandler,
} from '@mastra/server/handlers/mcp';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
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
export const getMcpServerMessageHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');
  const { req, res } = toReqRes(c.req.raw);
  console.log('Received MCP connection');
  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server '${serverId}' not found` }, 404);
  }

  console.log('Starting MCP connection');

  try {
    await server.startHTTP({
      url: new URL(c.req.url),
      httpPath: `/api/mcp/servers/${serverId}`,
      req,
      res,
      options: {
        sessionIdGenerator: undefined,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Server not found' }, 404);
  }

  const toFetchRes = await toFetchResponse(res);

  return toFetchRes;
};
