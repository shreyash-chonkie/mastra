import type { Agent } from '@mastra/core/agent';
import type { AgentCapabilities, AgentCard, AgentProvider, AgentSkill } from './types';

/**
 * Generate an agent card for the A2A protocol
 */
export function generateAgentCard({
  agent,
  baseUrl,
  includeStreaming = true,
}: {
  agent: Agent;
  baseUrl: string;
  includeStreaming?: boolean;
}): AgentCard {
  // Extract skills from the agent
  const skills: AgentSkill[] = [];

  // If the agent has tools, convert them to skills
  if (agent.tools) {
    Object.entries(agent.tools).forEach(([id, tool]) => {
      // Handle different tool formats
      const toolName = typeof tool === 'object' && tool !== null ? (tool as any).id || id : id;
      const toolDescription = typeof tool === 'object' && tool !== null ? (tool as any).description || null : null;

      skills.push({
        id,
        name: toolName,
        description: toolDescription,
        tags: [],
      });
    });
  }

  // Define provider information
  const provider: AgentProvider = {
    organization: 'Mastra AI',
    url: 'https://mastra.ai',
  };

  // Define capabilities
  const capabilities: AgentCapabilities = {
    streaming: includeStreaming,
    pushNotifications: false,
    stateTransitionHistory: true,
  };

  return {
    name: agent.name || 'Mastra Agent',
    description: typeof agent.instructions === 'string' ? agent.instructions : null,
    url: `${baseUrl}/api/a2a/${agent.name}`,
    provider,
    version: '0.0.1',
    documentationUrl: 'https://mastra.ai/docs',
    capabilities,
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    skills,
  };
}
