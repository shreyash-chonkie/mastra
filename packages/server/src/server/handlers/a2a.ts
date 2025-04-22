import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { generateAgentCard } from './a2a-protocol/utils';
import { handleError } from './error';

/**
 * Handler for getting all agent cards
 * @param mastra Mastra instance from context
 * @param baseUrl Base URL for the API
 * @returns Object containing all agent cards
 */
export async function getAgentCardsHandler({ mastra, baseUrl = '' }: Context & { baseUrl?: string }) {
  try {
    const agents = mastra.getAgents();

    const agentCards = Object.values(agents).map(agent => {
      // Create a simplified version of the agent card for the list
      const { name, description, url, provider, version } = generateAgentCard({
        agent,
        baseUrl,
        includeStreaming: false, // Simplified cards don't need full capability details
      });

      return {
        name,
        description,
        url,
        provider,
        version,
      };
    });

    return {
      agents: agentCards,
      count: agentCards.length,
    };
  } catch (error) {
    return handleError(error, 'Error getting agent cards');
  }
}

/**
 * Handler for getting a specific agent card
 * @param mastra Mastra instance from context
 * @param agentId ID of the agent to get the card for
 * @param baseUrl Base URL for the API
 * @returns Agent card for the specified agent
 */
export async function getAgentCardHandler({
  mastra,
  agentId,
  baseUrl = '',
}: Context & { agentId: string; baseUrl?: string }) {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const agentCard = generateAgentCard({ agent, baseUrl });
    return agentCard;
  } catch (error) {
    return handleError(error, 'Error getting agent card');
  }
}
