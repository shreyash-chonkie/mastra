import type { ClientOptions } from '../types';
import { BaseResource } from './base';

/**
 * MCP Server resource for interacting with MCP servers
 */
export class MCPServer extends BaseResource {
  constructor(
    options: ClientOptions,
    private serverId: string,
  ) {
    super(options);
  }

  /**
   * Get details about the MCP server
   * @returns Promise containing server details
   */
  details() {
    return this.request(`/api/mcp/servers/${this.serverId}`);
  }

  /**
   * Establish an SSE connection with the MCP server
   * @returns Promise containing the SSE response
   */
  async connectSSE() {
    const url = `/api/mcp/servers/${this.serverId}/sse`;

    return this.request(url, {
      method: 'POST',
      stream: true,
    });
  }

  /**
   * Call a tool on the MCP server
   * @param toolName - Name of the tool to call
   * @param params - Parameters for the tool
   * @returns Promise containing the tool execution result
   */
  callTool(toolName: string, params: Record<string, any>) {
    return this.request(`/api/mcp/servers/${this.serverId}/tools/${toolName}`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * List all tools available on the MCP server
   * @returns Promise containing a list of available tools
   */
  listTools() {
    return this.request(`/api/mcp/servers/${this.serverId}/tools`);
  }
}
