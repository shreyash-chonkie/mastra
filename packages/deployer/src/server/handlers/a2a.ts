import type { Mastra } from '@mastra/core/mastra';
import {
  getAgentCardsHandler as getOriginalAgentCardsHandler,
  getAgentCardHandler as getOriginalAgentCardHandler,
} from '@mastra/server/handlers/a2a';

import type { Context } from 'hono';

// Handler for getting all agent cards (A2A)
export async function getAgentCardsHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const baseUrl = c.req.query('baseUrl') || '';
  const result = await getOriginalAgentCardsHandler({ mastra, baseUrl });
  return c.json(result);
}

// Handler for getting a specific agent card (A2A)
export async function getAgentCardHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const baseUrl = c.req.query('baseUrl') || '';
  const result = await getOriginalAgentCardHandler({ mastra, agentId, baseUrl });
  return c.json(result);
}
