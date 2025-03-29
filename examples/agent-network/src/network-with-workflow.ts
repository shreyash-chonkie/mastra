import { openai } from '@ai-sdk/openai';
import { primaryResearchAgent, webSearchAgent } from './mastra/agents';
import { AgentNetwork } from './mastra/workflows/network-workflow';
import { processDataStream } from 'ai';

/**
 * This example demonstrates how to create a network of 3 specialized agents
 * that collaborate to solve content creation tasks.
 */

async function main() {
  // Create an OpenAI model instance
  const model = openai('gpt-4o');

  const network = new AgentNetwork({
    model,
    instructions: `
      You are a research coordination system that routes queries to the appropriate specialized agents.

      Research follows a procedure
      1. Gather information
      2. Synthesize information
      3. Create report

      Agents:
      1. Primary Research Agent: Coordinates research efforts, breaks down complex questions, and synthesizes information
      2. Web Search Agent: Finds up-to-date information online with proper citations
    `,
    agents: {
      primaryResearchAgent,
      webSearchAgent,
    },
  });

  // Example task that requires collaboration between agents
  const task =
    'Write me a detailed accurate and academic report about Skunks. It must be well researched and fact checked.';

  // const { runId, results } = await network.generate(task);

  const s = await network.stream(task);

  console.log(s);

  const nS = s.pipeThrough(new TextEncoderStream());

  await processDataStream({
    stream: nS as any,
    onTextPart: text => {
      process.stdout.write(text);
    },
    onFilePart: file => {
      console.log(file);
    },
    onDataPart: data => {
      console.log(data);
    },
    onErrorPart: error => {
      console.error(error);
    },
  });
}

main().catch(error => {
  console.error('Error running example:', error);
});
