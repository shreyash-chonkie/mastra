import type { IMastraLogger } from "@mastra/core/logger";
import type { Resource, ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";
import type { InternalMastraMCPClient, MastraMCPServerDefinition } from "./client";

interface ResourceClientActionsDependencies {
  getServerConfigs: () => Readonly<Record<string, MastraMCPServerDefinition>>;
  getConnectedClient: (name: string, config: MastraMCPServerDefinition) => Promise<InternalMastraMCPClient>;
  getConnectedClientForServer: (serverName: string) => Promise<InternalMastraMCPClient>;
  addToInstanceCache: () => void;
  getLogger: () => IMastraLogger;
}

export class ResourceClientActions {
  private readonly getServerConfigs: () => Readonly<Record<string, MastraMCPServerDefinition>>;
  private readonly getConnectedClient: (name: string, config: MastraMCPServerDefinition) => Promise<InternalMastraMCPClient>;
  private readonly getConnectedClientForServer: (serverName: string) => Promise<InternalMastraMCPClient>;
  private readonly addToInstanceCache: () => void;
  private readonly getLogger: () => IMastraLogger;

  constructor(dependencies: ResourceClientActionsDependencies) {
    this.getServerConfigs = dependencies.getServerConfigs;
    this.getConnectedClient = dependencies.getConnectedClient;
    this.getConnectedClientForServer = dependencies.getConnectedClientForServer;
    this.addToInstanceCache = dependencies.addToInstanceCache;
    this.getLogger = dependencies.getLogger;
  }

  /**
   * Get all resources from connected MCP servers, grouped by server name.
   * @returns A record of server names to their resources.
   */
  public async list(): Promise<Record<string, Resource[]>> {
    this.addToInstanceCache();
    const connectedResources: Record<string, Resource[]> = {};

    await Promise.all(
      Object.entries(this.getServerConfigs()).map(async ([serverName, serverConfig]) => {
        try {
          const client = await this.getConnectedClient(serverName, serverConfig);
          const response = await client.listResources();
          if (response && response.resources && Array.isArray(response.resources)) {
            connectedResources[serverName] = response.resources;
          } else {
            this.getLogger().warn(`Resources response from server ${serverName} did not have expected structure.`, {
              response,
            });
          }
        } catch (e) {
          this.getLogger().error(`Error getting resources from server ${serverName}`, {
            error: e instanceof Error ? e.message : String(e),
          });
          // Optionally rethrow or handle as per desired error strategy for aggregated calls
        }
      }),
    );
    return connectedResources;
  }

  /**
   * Get all resource templates from connected MCP servers, grouped by server name.
   * @returns A record of server names to their resource templates.
   */
  public async templates(): Promise<Record<string, ResourceTemplate[]>> {
    this.addToInstanceCache();
    const connectedTemplates: Record<string, ResourceTemplate[]> = {};
    await Promise.all(
      Object.entries(this.getServerConfigs()).map(async ([serverName, serverConfig]) => {
        try {
          const client = await this.getConnectedClient(serverName, serverConfig);
          const response = await client.listResourceTemplates();
          if (response && response.resourceTemplates && Array.isArray(response.resourceTemplates)) {
            connectedTemplates[serverName] = response.resourceTemplates;
          } else {
            this.getLogger().warn(
              `Resource templates response from server ${serverName} did not have expected structure.`,
              { response },
            );
          }
        } catch (e) {
          this.getLogger().error(`Error getting resource templates from server ${serverName}`, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }),
    );
    return connectedTemplates;
  }

  /**
   * Read a specific resource from a named server.
   * @param serverName The name of the server config.
   * @param uri The URI of the resource to read.
   * @returns The resource content.
   */
  public async read(serverName: string, uri: string) {
    this.addToInstanceCache();
    const client = await this.getConnectedClientForServer(serverName);
    return client.readResource(uri);
  }

  /**
   * Subscribe to a specific resource on a named server.
   * @param serverName The name of the server config.
   * @param uri The URI of the resource to subscribe to.
   */
  public async subscribe(serverName: string, uri: string) {
    this.addToInstanceCache();
    const client = await this.getConnectedClientForServer(serverName);
    return client.subscribeResource(uri);
  }

  /**
   * Unsubscribe from a specific resource on a named server.
   * @param serverName The name of the server config.
   * @param uri The URI of the resource to unsubscribe from.
   */
  public async unsubscribe(serverName: string, uri: string) {
    this.addToInstanceCache();
    const client = await this.getConnectedClientForServer(serverName);
    return client.unsubscribeResource(uri);
  }

  /**
   * Set a notification handler for when a specific resource is updated on a named server.
   * @param serverName The name of the server config.
   * @param handler The callback function to handle the notification.
   */
  public async onUpdated(serverName: string, handler: (params: { uri: string }) => void): Promise<void> {
    this.addToInstanceCache();
    const client = await this.getConnectedClientForServer(serverName);
    client.setResourceUpdatedNotificationHandler(handler);
  }

  /**
   * Set a notification handler for when the list of available resources changes on a named server.
   * @param serverName The name of the server config.
   * @param handler The callback function to handle the notification.
   */
  public async onListChanged(serverName: string, handler: () => void): Promise<void> {
    this.addToInstanceCache();
    const client = await this.getConnectedClientForServer(serverName);
    client.setResourceListChangedNotificationHandler(handler);
  }
}