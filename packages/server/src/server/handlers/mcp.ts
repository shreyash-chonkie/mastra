import type { Mastra, MastraMCPServer } from '@mastra/core';
import { HTTPException } from '../http-exception';

/**
 * Handler for GET /api/mcp/servers
 * Lists all MCP servers registered on the Mastra instance
 */
export const getMcpServersHandler = async ({ mastra }: { mastra: Mastra }) => {
  const servers = mastra.getMCPServers();

  return {
    servers: servers.map((server: MastraMCPServer) => ({
      id: server.name,
      name: server.name,
      version: server.version,
      tools: Object.keys(server.tools()).length,
    })),
  };
};

/**
 * Handler for GET /api/mcp/servers/:serverId
 * Returns details about a specific MCP server
 */
export const getMcpServerHandler = async ({ mastra, serverId }: { mastra: Mastra; serverId: string }) => {
  const server = mastra.getMCPServer(serverId);

  if (!server) {
    throw new HTTPException(404, { message: `MCP server '${serverId}' not found` });
  }

  const tools = server.tools();

  return {
    id: server.name,
    name: server.name,
    version: server.version,
    tools: Object.entries(tools).map(([name, tool]: [string, any]) => ({
      name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  };
};
