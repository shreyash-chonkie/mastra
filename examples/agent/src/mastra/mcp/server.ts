import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';

export const myMcpServer = new MCPServer({
  name: 'My MCP Server',
  version: '1.0.0',
  tools: {
    helloWorld: createTool({
      id: 'helloWorld',
      description: 'Say hello',
      execute: async () => {
        return 'Hello World';
      },
    }),
    helloWorld2: createTool({
      id: 'helloWorld2',
      description: 'Say hello',
      execute: async () => {
        return 'Hello World';
      },
    }),
  },
});

export const myMcpServerTwo = new MCPServer({
  name: 'My MCP Server Two',
  version: '1.0.0',
  tools: {
    helloWorld: createTool({
      id: 'helloWorld',
      description: 'Say hello',
      execute: async () => {
        return 'Hello World';
      },
    }),
    helloWorld2: createTool({
      id: 'helloWorld2',
      description: 'Say hello',
      execute: async () => {
        return 'Hello World';
      },
    }),
  },
});
