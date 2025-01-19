import { type Mastra } from '@mastra/core';
import { Hono } from 'hono';
import { pathToFileURL } from 'url';

import { cors } from 'hono/cors';

import { getAgentHandler, getAgentsHandler } from './handlers/agents';

type Bindings = {};

type Variables = {
  mastra: Mastra;
};

// Create typed Hono app
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Initialize tools
const mastraToolsPaths = process.env.MASTRA_TOOLS_PATH;
const toolImports = mastraToolsPaths
  ? await Promise.all(
      mastraToolsPaths.split(',').map(async toolPath => {
        return import(pathToFileURL(toolPath).href);
      }),
    )
  : [];

const tools = toolImports.reduce((acc, toolModule) => {
  Object.entries(toolModule).forEach(([key, tool]) => {
    acc[key] = tool;
  });
  return acc;
}, {});

// Types
interface ValidationResult {
  ok: boolean;
  errorResponse?: Record<string, string>;
}

// Middleware
app.use('*', cors());

// Add Mastra to context
app.use('*', async (c, next) => {
  // @ts-ignore
  const { mastra } = await import('./mastra.mjs');
  c.set('mastra', mastra);
  await next();
});

// Validation helper
const validateBody = async (body: Record<string, unknown>): Promise<ValidationResult> => {
  const errorResponse = Object.entries(body).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!value) {
      acc[key] = `${key} is required`;
    }
    return acc;
  }, {});

  if (Object.keys(errorResponse).length > 0) {
    return { ok: false, errorResponse };
  }

  return { ok: true };
};

// Root route
app.get('/', c => {
  return c.text('Welcome to your Mastra API!');
});

// Agents routes
app.get('/api/agents', getAgentsHandler);
app.get('/api/agents/:agentId', getAgentHandler);

// 404 handler
app.notFound(c => {
  return c.text('Not Found', 404);
});

// Error handler
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500,
  );
});

export default {
  fetch: app.fetch,
};
