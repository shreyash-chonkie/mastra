import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { WorkflowNetwork } from './wflow';

/**
 * This example demonstrates how to use the WorkflowNetwork class
 * to create a network of specialized agents that collaborate to solve tasks.
 */
async function main() {
  // Create an OpenAI model instance
  const model = openai('gpt-4o');

  // Create specialized agents
  const researchAgent = new Agent({
    name: 'Research Agent',
    instructions:
      'You are a research agent specialized in finding information about topics. Provide detailed, factual information.',
    model,
  });

  const creativeAgent = new Agent({
    name: 'Creative Agent',
    instructions:
      'You are a creative agent specialized in generating innovative ideas and content. Be imaginative and think outside the box.',
    model,
  });

  const criticalAgent = new Agent({
    name: 'Critical Agent',
    instructions:
      'You are a critical thinking agent specialized in analyzing information and identifying flaws or improvements. Be thorough and constructive.',
    model,
  });

  // Create the network with instructions for the router
  const network = new WorkflowNetwork({
    name: 'Example Network',
    agents: [researchAgent, creativeAgent, criticalAgent],
    model,
    instructions: `
      This is a network of specialized agents that work together to solve complex tasks.
      The Research Agent finds information, the Creative Agent generates ideas, and the Critical Agent analyzes and improves solutions.
      
      When routing:
      1. For factual questions or information gathering, use the Research Agent first
      2. For idea generation or creative tasks, use the Creative Agent
      3. For analysis, evaluation, or improvement of existing content, use the Critical Agent
      4. For complex tasks, consider using multiple agents in sequence (e.g., Research → Creative → Critical)
    `,
  });

  // Example query that might involve multiple agents
  const query =
    'I need ideas for a sustainable urban garden that can thrive in a small apartment balcony in a rainy climate.';

  console.log('Query:', query);
  console.log('\nGenerating response...\n');

  // Generate a response using the network
  const response = await network.generate(query);

  // Display the result
  console.log('Final Response:');
  console.log(response.text);

  // Display the interaction history
  console.log('\nAgent Interaction Summary:');
  console.log(network.getAgentInteractionSummary());
}

main().catch(error => {
  console.error('Error running example:', error);
});
