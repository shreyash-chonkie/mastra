import type { Mastra, MastraMCPServer } from '@mastra/core';
import type { ConvertedTool } from '@mastra/core/mcp';

/**
 * Handler for GET /api/mcp/servers
 * Lists all MCP servers registered on the Mastra instance
 */
export const getMcpServersHandler = async ({ mastra }: { mastra: Mastra }) => {
  const serversMap = mastra.getMCPServersRecord() || {};

  return {
    servers: Object.entries(serversMap as Record<string, MastraMCPServer>).map(([serverId, server]) => ({
      id: serverId,
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
    return {
      error: `MCP server '${serverId}' not found`,
      status: 404,
    };
  }

  const tools = server.tools(); // Record<string, ConvertedTool>

  return {
    id: serverId,
    name: server.name,
    version: server.version,
    tools: Object.entries(tools).map(([toolName, tool]: [string, ConvertedTool]) => ({
      name: toolName,
      description: tool.description,
      inputSchema: tool.inputSchema ? JSON.stringify(tool.inputSchema) : undefined,
    })),
  };
};
