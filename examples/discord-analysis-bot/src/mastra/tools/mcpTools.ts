import { MCPConfiguration } from '@mastra/mcp';

const mcpConfig = new MCPConfiguration({
  servers: {
    mastra: {
      command: 'npx',
      args: ['-y', '@mastra/mcp-docs-server@latest'],
    },
  },
});

export const mcpTools = await mcpConfig.getTools();
