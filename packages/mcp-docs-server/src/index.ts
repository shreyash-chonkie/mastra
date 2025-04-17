import fs from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { prepare } from './prepare-docs/prepare';
import { blogTool, blogInputSchema } from './tools/blog';
import { changesTool, changesInputSchema } from './tools/changes';
import { 
  startMastraCourse, 
  getMastraCourseStatus, 
  startMastraCourseLesson, 
  nextMastraCourseStep, 
  clearMastraCourseHistory 
} from './tools/course';
import { docsTool, docsInputSchema } from './tools/docs';
import { examplesTool, examplesInputSchema } from './tools/examples';
import { fromPackageRoot } from './utils';

if (process.env.REBUILD_DOCS_ON_START === 'true') {
  await prepare();
}

const server = new Server(
  {
    name: 'Mastra Documentation Server',
    version: JSON.parse(await fs.readFile(fromPackageRoot(`package.json`), 'utf8')).version,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'mastraBlog',
      description: blogTool.description,
      inputSchema: zodToJsonSchema(blogInputSchema),
    },
    {
      name: 'mastraDocs',
      description: docsTool.description,
      inputSchema: zodToJsonSchema(docsInputSchema),
    },
    {
      name: 'mastraExamples',
      description: examplesTool.description,
      inputSchema: zodToJsonSchema(examplesInputSchema),
    },
    {
      name: 'mastraChanges',
      description: changesTool.description,
      inputSchema: zodToJsonSchema(changesInputSchema),
    },
    {
      name: 'startMastraCourse',
      description: startMastraCourse.description,
      inputSchema: zodToJsonSchema(startMastraCourse.parameters),
    },
    {
      name: 'getMastraCourseStatus',
      description: getMastraCourseStatus.description,
      inputSchema: zodToJsonSchema(getMastraCourseStatus.parameters),
    },
    {
      name: 'startMastraCourseLesson',
      description: startMastraCourseLesson.description,
      inputSchema: zodToJsonSchema(startMastraCourseLesson.parameters),
    },
    {
      name: 'nextMastraCourseStep',
      description: nextMastraCourseStep.description,
      inputSchema: zodToJsonSchema(nextMastraCourseStep.parameters),
    },
    {
      name: 'clearMastraCourseHistory',
      description: clearMastraCourseHistory.description,
      inputSchema: zodToJsonSchema(clearMastraCourseHistory.parameters),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    switch (request.params.name) {
      case 'mastraBlog': {
        const args = blogInputSchema.parse(request.params.arguments);
        return await blogTool.execute(args);
      }
      case 'mastraDocs': {
        const args = docsInputSchema.parse(request.params.arguments);
        return await docsTool.execute(args);
      }
      case 'mastraExamples': {
        const args = examplesInputSchema.parse(request.params.arguments);
        return await examplesTool.execute(args);
      }
      case 'mastraChanges': {
        const args = changesInputSchema.parse(request.params.arguments);
        return await changesTool.execute(args);
      }
      case 'startMastraCourse': {
        const args = startMastraCourse.parameters.parse(request.params.arguments);
        const result = await startMastraCourse.execute(args);
        return {
          content: [{ type: 'text', text: result }],
          isError: false,
        };
      }
      case 'getMastraCourseStatus': {
        const args = getMastraCourseStatus.parameters.parse(request.params.arguments);
        const result = await getMastraCourseStatus.execute(args);
        return {
          content: [{ type: 'text', text: result }],
          isError: false,
        };
      }
      case 'startMastraCourseLesson': {
        const args = startMastraCourseLesson.parameters.parse(request.params.arguments);
        const result = await startMastraCourseLesson.execute(args);
        return {
          content: [{ type: 'text', text: result }],
          isError: false,
        };
      }
      case 'nextMastraCourseStep': {
        const args = nextMastraCourseStep.parameters.parse(request.params.arguments);
        const result = await nextMastraCourseStep.execute(args);
        return {
          content: [{ type: 'text', text: result }],
          isError: false,
        };
      }
      case 'clearMastraCourseHistory': {
        const args = clearMastraCourseHistory.parameters.parse(request.params.arguments);
        const result = await clearMastraCourseHistory.execute(args);
        return {
          content: [{ type: 'text', text: result }],
          isError: false,
        };
      }
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
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
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Mastra Docs MCP Server running on stdio');
}

export { runServer, server };
