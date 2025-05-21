import { randomUUID } from 'crypto';
import type * as http from 'node:http';
import type { InternalCoreTool } from '@mastra/core';
import { makeCoreTool } from '@mastra/core';
import type { ToolsInput } from '@mastra/core/agent';
import { MCPServerBase } from '@mastra/core/mcp';
import type {
  MCPServerConfig,
  ServerInfo,
  ServerDetailInfo,
  ConvertedTool,
  MCPServerHonoSSEOptions,
  MCPServerSSEOptions,
} from '@mastra/core/mcp';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { StreamableHTTPServerTransportOptions } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ResourceContents, Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import type { SSEStreamingApi } from 'hono/streaming';
import { streamSSE } from 'hono/streaming';
import { SSETransport } from 'hono-mcp-server-sse-transport';
import { z } from 'zod';

export type MCPServerResourceContentCallback = ({
  uri,
}: {
  uri: string;
}) => Promise<MCPServerResourceContent | MCPServerResourceContent[]>;
export type MCPServerResourceContent = { text?: string } | { blob?: string };
export type MCPServerResources = {
  listResources: () => Promise<Resource[]>;
  getResourceContent: MCPServerResourceContentCallback;
  resourceTemplates?: () => Promise<ResourceTemplate[]>;
};
export class MCPServer extends MCPServerBase {
  private server: Server;
  private stdioTransport?: StdioServerTransport;
  private sseTransport?: SSEServerTransport;
  private sseHonoTransports: Map<string, SSETransport>;
  private streamableHTTPTransport?: StreamableHTTPServerTransport;
  private listToolsHandlerIsRegistered: boolean = false;
  private callToolHandlerIsRegistered: boolean = false;
  private listResourcesHandlerIsRegistered: boolean = false;
  private readResourceHandlerIsRegistered: boolean = false;
  private listResourceTemplatesHandlerIsRegistered: boolean = false;
  private subscribeResourceHandlerIsRegistered: boolean = false;
  private unsubscribeResourceHandlerIsRegistered: boolean = false;

  private definedResources?: Resource[];
  private definedResourceTemplates?: ResourceTemplate[];
  private resourceOptions?: MCPServerResources;
  private subscriptions: Set<string> = new Set();

  /**
   * Get the current stdio transport.
   */
  public getStdioTransport(): StdioServerTransport | undefined {
    return this.stdioTransport;
  }

  /**
   * Get the current SSE transport.
   */
  public getSseTransport(): SSEServerTransport | undefined {
    return this.sseTransport;
  }

  /**
   * Get the current SSE Hono transport.
   */
  public getSseHonoTransport(sessionId: string): SSETransport | undefined {
    return this.sseHonoTransports.get(sessionId);
  }

  /**
   * Get the current streamable HTTP transport.
   */
  public getStreamableHTTPTransport(): StreamableHTTPServerTransport | undefined {
    return this.streamableHTTPTransport;
  }

  /**
   * Construct a new MCPServer instance.
   * @param opts - Configuration options for the server, including registry metadata.
   */
  constructor(opts: MCPServerConfig & { resources?: MCPServerResources }) {
    super(opts);
    this.resourceOptions = opts.resources;

    const capabilities: any = {
      tools: {},
      logging: { enabled: true },
    };

    if (opts.resources) {
      capabilities.resources = { subscribe: true, listChanged: true };
    }

    this.server = new Server({ name: this.name, version: this.version }, { capabilities });

    this.logger.info(
      `Initialized MCPServer '${this.name}' v${this.version} (ID: ${this.id}) with tools: ${Object.keys(this.convertedTools).join(', ')} and resources. Capabilities: ${JSON.stringify(capabilities.resources)}`,
    );

    this.sseHonoTransports = new Map();
    this.registerListToolsHandler();
    this.registerCallToolHandler();
    if (opts.resources) {
      this.registerListResourcesHandler();
      this.registerReadResourceHandler({ getResourcesCallback: opts.resources.getResourceContent });
      this.registerSubscribeResourceHandler();
      this.registerUnsubscribeResourceHandler();

      if (opts.resources.resourceTemplates) {
        this.registerListResourceTemplatesHandler();
      }
    }
  }

  /**
   * Convert and validate all provided tools, logging registration status.
   * @param tools Tool definitions
   * @returns Converted tools registry
   */
  convertTools(tools: ToolsInput): Record<string, ConvertedTool> {
    const convertedTools: Record<string, ConvertedTool> = {};
    for (const toolName of Object.keys(tools)) {
      const toolInstance = tools[toolName];
      if (!toolInstance) {
        this.logger.warn(`Tool instance for '${toolName}' is undefined. Skipping.`);
        continue;
      }

      if (typeof toolInstance.execute !== 'function') {
        this.logger.warn(`Tool '${toolName}' does not have a valid execute function. Skipping.`);
        continue;
      }

      const options = {
        name: toolName,
        runtimeContext: new RuntimeContext(),
        mastra: this.mastra,
        logger: this.logger,
        description: toolInstance?.description,
      };

      const coreTool = makeCoreTool(toolInstance, options) as InternalCoreTool;

      convertedTools[toolName] = {
        name: toolName,
        description: coreTool.description,
        parameters: coreTool.parameters,
        execute: coreTool.execute!,
      };
      this.logger.info(`Registered tool: '${toolName}' [${toolInstance?.description || 'No description'}]`);
    }
    this.logger.info(`Total tools registered: ${Object.keys(convertedTools).length}`);
    return convertedTools;
  }

  /**
   * Register the ListTools handler for listing all available tools.
   */
  private registerListToolsHandler() {
    if (this.listToolsHandlerIsRegistered) {
      return;
    }
    this.listToolsHandlerIsRegistered = true;
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling ListTools request');
      return {
        tools: Object.values(this.convertedTools).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.parameters.jsonSchema,
        })),
      };
    });
  }

  /**
   * Register the CallTool handler for executing a tool by name.
   */
  private registerCallToolHandler() {
    if (this.callToolHandlerIsRegistered) {
      return;
    }
    this.callToolHandlerIsRegistered = true;
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const startTime = Date.now();
      try {
        const tool = this.convertedTools[request.params.name];
        if (!tool) {
          this.logger.warn(`CallTool: Unknown tool '${request.params.name}' requested.`);
          return {
            content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
            isError: true,
          };
        }

        this.logger.debug(`CallTool: Invoking '${request.params.name}' with arguments:`, request.params.arguments);

        const validation = tool.parameters.validate?.(request.params.arguments ?? {});
        if (validation && !validation.success) {
          this.logger.warn(`CallTool: Invalid tool arguments for '${request.params.name}'`, {
            errors: validation.error,
          });
          return {
            content: [{ type: 'text', text: `Invalid tool arguments: ${JSON.stringify(validation.error)}` }],
            isError: true,
          };
        }
        if (!tool.execute) {
          this.logger.warn(`CallTool: Tool '${request.params.name}' does not have an execute function.`);
          return {
            content: [{ type: 'text', text: `Tool '${request.params.name}' does not have an execute function.` }],
            isError: true,
          };
        }

        const result = await tool.execute(validation?.value, { messages: [], toolCallId: '' });
        const duration = Date.now() - startTime;
        this.logger.info(`Tool '${request.params.name}' executed successfully in ${duration}ms.`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
          isError: false,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        if (error instanceof z.ZodError) {
          this.logger.warn('Invalid tool arguments', {
            tool: request.params.name,
            errors: error.errors,
            duration: `${duration}ms`,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
              },
            ],
            isError: true,
          };
        }
        this.logger.error(`Tool execution failed: ${request.params.name}`, { error });
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    });
  }

  /**
   * Register the ListResources handler for listing all available resources.
   */
  private registerListResourcesHandler() {
    if (this.listResourcesHandlerIsRegistered) {
      return;
    }
    this.listResourcesHandlerIsRegistered = true;
    const capturedResourceOptions = this.resourceOptions; // Capture for TS narrowing

    if (!capturedResourceOptions?.listResources) {
      this.logger.warn('ListResources capability not supported by server configuration.');
      return;
    }

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      this.logger.debug('Handling ListResources request');
      if (this.definedResources) {
        return { resources: this.definedResources };
      } else {
        try {
          const resources = await capturedResourceOptions.listResources();
          // Cache the resources
          this.definedResources = resources;
          this.logger.debug(`Fetched and cached ${this.definedResources.length} resources.`);
          return { resources: this.definedResources };
        } catch (error) {
          this.logger.error('Error fetching resources via listResources():', { error });
          // Re-throw to let the MCP Server SDK handle formatting the error response
          throw error;
        }
      }
    });
  }

  /**
   * Register the ReadResource handler for reading a resource by URI.
   */
  private registerReadResourceHandler({
    getResourcesCallback,
  }: {
    getResourcesCallback: MCPServerResourceContentCallback;
  }) {
    if (this.readResourceHandlerIsRegistered) {
      return;
    }
    this.readResourceHandlerIsRegistered = true;
    this.server.setRequestHandler(ReadResourceRequestSchema, async request => {
      const startTime = Date.now();
      const uri = request.params.uri;
      this.logger.debug(`Handling ReadResource request for URI: ${uri}`);

      if (!this.definedResources) {
        this.definedResources = await this.resourceOptions?.listResources?.();
      }

      const resource = this.definedResources?.find(r => r.uri === uri);

      if (!resource) {
        this.logger.warn(`ReadResource: Unknown resource URI '${uri}' requested.`);
        throw new Error(`Resource not found: ${uri}`);
      }

      try {
        const resourcesOrResourceContent = await getResourcesCallback({ uri });
        const resourcesContent = Array.isArray(resourcesOrResourceContent)
          ? resourcesOrResourceContent
          : [resourcesOrResourceContent];
        const contents: ResourceContents[] = resourcesContent.map(resourceContent => {
          const contentItem: ResourceContents = {
            uri: resource.uri,
            mimeType: resource.mimeType,
          };
          if ('text' in resourceContent) {
            contentItem.text = resourceContent.text;
          }

          if ('blob' in resourceContent) {
            contentItem.blob = resourceContent.blob;
          }

          return contentItem;
        });
        const duration = Date.now() - startTime;
        this.logger.info(`Resource '${uri}' read successfully in ${duration}ms.`);
        return {
          contents,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error(`Failed to get content for resource URI '${uri}' in ${duration}ms`, { error });
        throw error;
      }
    });
  }

  /**
   * Register the ListResourceTemplates handler.
   */
  private registerListResourceTemplatesHandler() {
    if (this.listResourceTemplatesHandlerIsRegistered) {
      return;
    }

    // If this method is called, this.resourceOptions and this.resourceOptions.resourceTemplates should exist
    // due to the constructor logic checking opts.resources.resourceTemplates.
    if (!this.resourceOptions || typeof this.resourceOptions.resourceTemplates !== 'function') {
      this.logger.warn(
        'ListResourceTemplates handler called, but resourceTemplates function is not available on resourceOptions or not a function.',
      );
      // Register a handler that returns empty templates if not properly configured.
      this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
        this.logger.debug('Handling ListResourceTemplates request (no templates configured or resourceOptions issue)');
        return { resourceTemplates: [] };
      });
      this.listResourceTemplatesHandlerIsRegistered = true;
      return;
    }

    // Typescript can now infer resourceTemplatesFn is a function.
    const resourceTemplatesFn = this.resourceOptions.resourceTemplates;

    this.listResourceTemplatesHandlerIsRegistered = true;
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      this.logger.debug('Handling ListResourceTemplates request');
      if (this.definedResourceTemplates) {
        return { resourceTemplates: this.definedResourceTemplates };
      } else {
        try {
          const templates = await resourceTemplatesFn(); // Safe to call now
          this.definedResourceTemplates = templates;
          this.logger.debug(`Fetched and cached ${this.definedResourceTemplates.length} resource templates.`);
          return { resourceTemplates: this.definedResourceTemplates };
        } catch (error) {
          this.logger.error('Error fetching resource templates via resourceTemplates():', { error });
          // Re-throw to let the MCP Server SDK handle formatting the error response
          throw error;
        }
      }
    });
  }

  /**
   * Register the SubscribeResource handler.
   */
  private registerSubscribeResourceHandler() {
    if (this.subscribeResourceHandlerIsRegistered) {
      return;
    }
    if (!SubscribeRequestSchema) {
      this.logger.warn('SubscribeRequestSchema not available, cannot register SubscribeResource handler.');
      return;
    }
    this.subscribeResourceHandlerIsRegistered = true;
    this.server.setRequestHandler(SubscribeRequestSchema as any, async (request: { params: { uri: string } }) => {
      const uri = request.params.uri;
      this.logger.info(`Received resources/subscribe request for URI: ${uri}`);
      this.subscriptions.add(uri);
      return {};
    });
  }

  /**
   * Register the UnsubscribeResource handler.
   */
  private registerUnsubscribeResourceHandler() {
    if (this.unsubscribeResourceHandlerIsRegistered) {
      return;
    }
    this.unsubscribeResourceHandlerIsRegistered = true;

    this.server.setRequestHandler(UnsubscribeRequestSchema as any, async (request: { params: { uri: string } }) => {
      const uri = request.params.uri;
      this.logger.info(`Received resources/unsubscribe request for URI: ${uri}`);
      this.subscriptions.delete(uri);
      return {};
    });
  }

  /**
   * Start the MCP server using stdio transport (for Windsurf integration).
   */
  public async startStdio(): Promise<void> {
    this.stdioTransport = new StdioServerTransport();
    await this.server.connect(this.stdioTransport);
    this.logger.info('Started MCP Server (stdio)');
  }

  /**
   * Handles MCP-over-SSE protocol for user-provided HTTP servers.
   * Call this from your HTTP server for both the SSE and message endpoints.
   *
   * @param url Parsed URL of the incoming request
   * @param ssePath Path for establishing the SSE connection (e.g. '/sse')
   * @param messagePath Path for POSTing client messages (e.g. '/message')
   * @param req Incoming HTTP request
   * @param res HTTP response (must support .write/.end)
   */
  public async startSSE({ url, ssePath, messagePath, req, res }: MCPServerSSEOptions): Promise<void> {
    if (url.pathname === ssePath) {
      await this.connectSSE({
        messagePath,
        res,
      });
    } else if (url.pathname === messagePath) {
      this.logger.debug('Received message');
      if (!this.sseTransport) {
        res.writeHead(503);
        res.end('SSE connection not established');
        return;
      }
      await this.sseTransport.handlePostMessage(req, res);
    } else {
      this.logger.debug('Unknown path:', { path: url.pathname });
      res.writeHead(404);
      res.end();
    }
  }

  /**
   * Handles MCP-over-SSE protocol for user-provided HTTP servers.
   * Call this from your HTTP server for both the SSE and message endpoints.
   *
   * @param url Parsed URL of the incoming request
   * @param ssePath Path for establishing the SSE connection (e.g. '/sse')
   * @param messagePath Path for POSTing client messages (e.g. '/message')
   * @param context Incoming Hono context
   */
  public async startHonoSSE({ url, ssePath, messagePath, context }: MCPServerHonoSSEOptions) {
    if (url.pathname === ssePath) {
      return streamSSE(context, async stream => {
        await this.connectHonoSSE({
          messagePath,
          stream,
        });
      });
    } else if (url.pathname === messagePath) {
      this.logger.debug('Received message');
      const sessionId = context.req.query('sessionId');
      this.logger.debug('Received message for sessionId', { sessionId });
      if (!sessionId) {
        return context.text('No sessionId provided', 400);
      }
      if (!this.sseHonoTransports.has(sessionId)) {
        return context.text(`No transport found for sessionId ${sessionId}`, 400);
      }
      const message = await this.sseHonoTransports.get(sessionId)?.handlePostMessage(context);
      if (!message) {
        return context.text('Transport not found', 400);
      }
      return message;
    } else {
      this.logger.debug('Unknown path:', { path: url.pathname });
      return context.text('Unknown path', 404);
    }
  }

  /**
   * Handles MCP-over-StreamableHTTP protocol for user-provided HTTP servers.
   * Call this from your HTTP server for the streamable HTTP endpoint.
   *
   * @param url Parsed URL of the incoming request
   * @param httpPath Path for establishing the streamable HTTP connection (e.g. '/mcp')
   * @param req Incoming HTTP request
   * @param res HTTP response (must support .write/.end)
   * @param options Optional options to pass to the transport (e.g. sessionIdGenerator)
   */
  public async startHTTP({
    url,
    httpPath,
    req,
    res,
    options = { sessionIdGenerator: () => randomUUID() },
  }: {
    url: URL;
    httpPath: string;
    req: http.IncomingMessage;
    res: http.ServerResponse<http.IncomingMessage>;
    options?: StreamableHTTPServerTransportOptions;
  }) {
    if (url.pathname === httpPath) {
      this.streamableHTTPTransport = new StreamableHTTPServerTransport(options);
      try {
        await this.server.connect(this.streamableHTTPTransport);
      } catch (error) {
        this.logger.error('Error connecting to MCP server', { error });
        res.writeHead(500);
        res.end('Error connecting to MCP server');
        return;
      }

      try {
        await this.streamableHTTPTransport.handleRequest(req, res);
      } catch (error) {
        this.logger.error('Error handling MCP connection', { error });
        res.writeHead(500);
        res.end('Error handling MCP connection');
        return;
      }

      this.server.onclose = async () => {
        this.streamableHTTPTransport = undefined;
        await this.server.close();
      };

      res.on('close', () => {
        this.streamableHTTPTransport = undefined;
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  }

  public async connectSSE({
    messagePath,
    res,
  }: {
    messagePath: string;
    res: http.ServerResponse<http.IncomingMessage>;
  }) {
    this.logger.debug('Received SSE connection');
    this.sseTransport = new SSEServerTransport(messagePath, res);
    await this.server.connect(this.sseTransport);

    this.server.onclose = async () => {
      this.sseTransport = undefined;
      await this.server.close();
    };

    res.on('close', () => {
      this.sseTransport = undefined;
    });
  }

  public async connectHonoSSE({ messagePath, stream }: { messagePath: string; stream: SSEStreamingApi }) {
    this.logger.debug('Received SSE connection');
    const sseTransport = new SSETransport(messagePath, stream);
    const sessionId = sseTransport.sessionId;
    this.logger.debug('SSE Transport created with sessionId:', { sessionId });
    this.sseHonoTransports.set(sessionId, sseTransport);

    stream.onAbort(() => {
      this.logger.debug('SSE Transport aborted with sessionId:', { sessionId });
      this.sseHonoTransports.delete(sessionId);
    });

    await this.server.connect(sseTransport);
    this.server.onclose = async () => {
      this.logger.debug('SSE Transport closed with sessionId:', { sessionId });
      this.sseHonoTransports.delete(sessionId);
      await this.server.close();
    };

    while (true) {
      // This will keep the connection alive
      // You can also await for a promise that never resolves
      const sessionIds = Array.from(this.sseHonoTransports.keys() || []);
      this.logger.debug('Active Hono SSE sessions:', { sessionIds });
      await stream.write(':keep-alive\n\n');
      await stream.sleep(60_000);
    }
  }

  /**
   * Close the MCP server and all its connections
   */
  async close() {
    this.callToolHandlerIsRegistered = false;
    this.listToolsHandlerIsRegistered = false;
    this.listResourcesHandlerIsRegistered = false;
    this.readResourceHandlerIsRegistered = false;
    this.listResourceTemplatesHandlerIsRegistered = false;
    this.subscribeResourceHandlerIsRegistered = false;
    this.unsubscribeResourceHandlerIsRegistered = false;

    try {
      if (this.stdioTransport) {
        await this.stdioTransport.close?.();
        this.stdioTransport = undefined;
      }
      if (this.sseTransport) {
        await this.sseTransport.close?.();
        this.sseTransport = undefined;
      }
      if (this.sseHonoTransports) {
        for (const transport of this.sseHonoTransports.values()) {
          await transport.close?.();
        }
        this.sseHonoTransports.clear();
      }
      if (this.streamableHTTPTransport) {
        await this.streamableHTTPTransport.close?.();
        this.streamableHTTPTransport = undefined;
      }
      await this.server.close();
      this.logger.info('MCP server closed.');
    } catch (error) {
      this.logger.error('Error closing MCP server:', { error });
    }
  }

  /**
   * Gets the basic information about the server, conforming to the Server schema.
   * @returns ServerInfo object.
   */
  public getServerInfo(): ServerInfo {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      repository: this.repository,
      version_detail: {
        version: this.version,
        release_date: this.releaseDate,
        is_latest: this.isLatest,
      },
    };
  }

  /**
   * Gets detailed information about the server, conforming to the ServerDetail schema.
   * @returns ServerDetailInfo object.
   */
  public getServerDetail(): ServerDetailInfo {
    return {
      ...this.getServerInfo(),
      package_canonical: this.packageCanonical,
      packages: this.packages,
      remotes: this.remotes,
    };
  }

  /**
   * Gets a list of tools provided by this MCP server, including their schemas.
   * This leverages the same tool information used by the internal ListTools MCP request.
   * @returns An object containing an array of tool information.
   */
  public getToolListInfo(): { tools: Array<{ name: string; description?: string; inputSchema: any }> } {
    this.logger.debug(`Getting tool list information for MCPServer '${this.name}'`);
    return {
      tools: Object.entries(this.convertedTools).map(([toolId, tool]) => ({
        id: toolId,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters?.jsonSchema || tool.parameters,
      })),
    };
  }

  /**
   * Gets information for a specific tool provided by this MCP server.
   * @param toolId The ID/name of the tool to retrieve.
   * @returns Tool information (name, description, inputSchema) or undefined if not found.
   */
  public getToolInfo(toolId: string): { name: string; description?: string; inputSchema: any } | undefined {
    const tool = this.convertedTools[toolId];
    if (!tool) {
      this.logger.debug(`Tool '${toolId}' not found on MCPServer '${this.name}'`);
      return undefined;
    }
    this.logger.debug(`Getting info for tool '${toolId}' on MCPServer '${this.name}'`);
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters?.jsonSchema || tool.parameters,
    };
  }

  /**
   * Executes a specific tool provided by this MCP server.
   * @param toolId The ID/name of the tool to execute.
   * @param args The arguments to pass to the tool's execute function.
   * @param executionContext Optional context for the tool execution.
   * @returns A promise that resolves to the result of the tool execution.
   * @throws Error if the tool is not found, validation fails, or execution fails.
   */
  public async executeTool(
    toolId: string,
    args: any,
    executionContext?: { messages?: any[]; toolCallId?: string },
  ): Promise<any> {
    const tool = this.convertedTools[toolId];
    if (!tool) {
      this.logger.warn(`ExecuteTool: Unknown tool '${toolId}' requested on MCPServer '${this.name}'.`);
      throw new Error(`Unknown tool: ${toolId}`);
    }

    this.logger.debug(`ExecuteTool: Invoking '${toolId}' with arguments:`, args);

    let validatedArgs = args;
    if (tool.parameters instanceof z.ZodType && typeof tool.parameters.safeParse === 'function') {
      const validation = tool.parameters.safeParse(args ?? {});
      if (!validation.success) {
        const errorMessages = validation.error.errors
          .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        this.logger.warn(`ExecuteTool: Invalid tool arguments for '${toolId}': ${errorMessages}`, {
          errors: validation.error.format(),
        });
        throw new z.ZodError(validation.error.issues);
      }
      validatedArgs = validation.data;
    } else {
      this.logger.debug(
        `ExecuteTool: Tool '${toolId}' parameters is not a Zod schema with safeParse or is undefined. Skipping validation.`,
      );
    }

    if (!tool.execute) {
      this.logger.error(`ExecuteTool: Tool '${toolId}' does not have an execute function.`);
      throw new Error(`Tool '${toolId}' cannot be executed.`);
    }

    try {
      const finalExecutionContext = {
        messages: executionContext?.messages || [],
        toolCallId: executionContext?.toolCallId || randomUUID(),
      };
      const result = await tool.execute(validatedArgs, finalExecutionContext);
      this.logger.info(`ExecuteTool: Tool '${toolId}' executed successfully.`);
      return result;
    } catch (error) {
      this.logger.error(`ExecuteTool: Tool execution failed for '${toolId}':`, { error });
      throw error instanceof Error ? error : new Error(`Execution of tool '${toolId}' failed: ${String(error)}`);
    }
  }

  /**
   * Checks if any resources have been updated.
   * If the resource is subscribed to by clients, an update notification will be sent.
   */
  public async notifyResourcesUpdated({ uri }: { uri: string }): Promise<void> {
    if (this.subscriptions.has(uri)) {
      this.logger.info(`Sending notifications/resources/updated for externally notified resource: ${uri}`);
      await this.server.sendResourceUpdated({ uri });
    } else {
      this.logger.debug(`Resource ${uri} was updated, but no active subscriptions for it.`);
    }
  }

  /**
   * Notifies the server that the overall list of available resources has changed.
   * This will clear the internal cache of defined resources and send a list_changed notification to clients.
   */
  public async notifyResourceListChanged(): Promise<void> {
    this.logger.info('Resource list change externally notified. Clearing definedResources and sending notification.');
    this.definedResources = undefined; // Clear cached resources
    this.definedResourceTemplates = undefined; // Clear cached resource templates
    await this.server.sendResourceListChanged();
  }
}
