import type { ClientOptions, GetMCPServerResponse } from '../types';
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
  details(): Promise<GetMCPServerResponse> {
    return this.request(`/api/mcp/servers/${this.serverId}`);
  }
}
