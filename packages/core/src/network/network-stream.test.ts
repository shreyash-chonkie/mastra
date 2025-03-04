import { createOpenAI } from '@ai-sdk/openai';
import { config } from 'dotenv';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import { AgentNetwork } from './network';
import { NetworkState } from './state';

config();

// Create OpenAI client
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Set a longer timeout for tests that use real API calls
const TEST_TIMEOUT = 10000;

describe('AgentNetwork Streaming', () => {
  it.only(
    'should stream network execution with events',
    async () => {
      // Create search agent
      const searchAgent = new Agent({
        name: 'Search',
        instructions: 'You search for information on the web',
        model: openai('gpt-4o'),
      });

      // Create summary agent
      const summaryAgent = new Agent({
        name: 'Summary',
        instructions: 'You summarize information into concise points',
        model: openai('gpt-4o'),
      });

      // Create a network with a custom router that always uses searchAgent first, then summaryAgent
      const network = new AgentNetwork({
        name: 'Research Assistant',
        agents: [searchAgent, summaryAgent],
        routingModel: openai('gpt-4o'),
        router: async ({ callCount }) => {
          if (callCount === 0) return searchAgent;
          if (callCount === 1) return summaryAgent;
          return undefined; // Done after two calls
        },
        maxSteps: 3, // Limit to 3 steps to be safe
      });

      // Mock callback functions
      const onStepStartMock = vi.fn();
      const onStepFinishMock = vi.fn();
      const onFinishMock = vi.fn();

      // Stream the network execution
      const streamResult = await network.stream('What is quantum computing?', {
        onStepStart: onStepStartMock,
        onStepFinish: onStepFinishMock,
        onFinish: onFinishMock,
      });

      // Collect all chunks from the stream
      const chunks: any[] = [];
      // Create a map to track continuous output per agent
      const agentOutputs = new Map<string, string>();

      for await (const chunk of streamResult.stream) {
        if (chunk.type === 'agentChunk') {
          // Get the current agent's output
          const currentOutput = agentOutputs.get(chunk.agent) || '';
          // Update with new chunk
          agentOutputs.set(chunk.agent, currentOutput + chunk.chunk);

          // Write the chunk to stdout without a newline
          process.stdout.write(chunk.chunk);
        } else if (chunk.type === 'stepStart') {
          // For step start, print a header for the agent
          console.log(`\n\n--- Starting ${chunk.agent} (Step ${chunk.step}) ---`);
          // Clear previous output for this agent
          agentOutputs.set(chunk.agent, '');
        } else if (chunk.type === 'stepFinish') {
          // For step finish, print a footer
          console.log(`\n\n--- Finished ${chunk.result.agent} (Step ${chunk.result.step}) ---`);
          // Print the complete output for this agent
          console.log(`Complete output: ${agentOutputs.get(chunk.result.agent) || ''}`);
        } else {
          // For other event types, just log them normally
          console.log(JSON.stringify(chunk, null, 2));
        }
        chunks.push(chunk);
      }

      // Get the final result
      const finalResult = await streamResult.done();

      console.log(finalResult, 'HI');

      // Verify callbacks were called
      expect(onStepStartMock).toHaveBeenCalledTimes(2);
      expect(onStepFinishMock).toHaveBeenCalledTimes(2);
      expect(onFinishMock).toHaveBeenCalledTimes(1);

      // Verify stream chunks
      expect(chunks.length).toBeGreaterThan(0);

      // Check for step start events
      const stepStartEvents = chunks.filter(chunk => chunk.type === 'stepStart');
      expect(stepStartEvents.length).toBe(2);

      // Check for agent chunk events
      const agentChunkEvents = chunks.filter(chunk => chunk.type === 'agentChunk');
      expect(agentChunkEvents.length).toBeGreaterThan(0);

      // Check for step finish events
      const stepFinishEvents = chunks.filter(chunk => chunk.type === 'stepFinish');
      expect(stepFinishEvents.length).toBe(2);

      // Check for complete event
      const completeEvents = chunks.filter(chunk => chunk.type === 'complete');
      expect(completeEvents.length).toBe(1);

      // Verify final result is a string
      expect(typeof finalResult).toBe('string');
      expect(finalResult.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT,
  );

  it(
    'should respect maxSteps parameter during streaming',
    async () => {
      // Create an agent that will be used in a loop
      const loopAgent = new Agent({
        name: 'Loop',
        instructions: 'You process information in a loop',
        model: openai('gpt-4o'),
      });

      // Create a network with a router that always returns the same agent (to create a loop)
      const network = new AgentNetwork({
        name: 'Looping Network',
        agents: [loopAgent],
        routingModel: openai('gpt-4o'),
        router: async () => loopAgent, // Always return the same agent to create a loop
        maxSteps: 5, // Default max steps
      });

      // Stream the network with a custom maxSteps that's lower than the default
      const streamResult = await network.stream('Process this in a loop', {
        maxSteps: 3, // Override with a lower value
      });

      // Collect all chunks from the stream
      const chunks: any[] = [];
      for await (const chunk of streamResult.stream) {
        chunks.push(chunk);
      }

      // Check for warning events about reaching max steps
      const warningEvents = chunks.filter(chunk => chunk.type === 'warning');
      expect(warningEvents.length).toBe(1);
      expect(warningEvents[0].message).toContain('maximum steps');

      // Count step events to verify maxSteps was respected
      const stepStartEvents = chunks.filter(chunk => chunk.type === 'stepStart');
      expect(stepStartEvents.length).toBe(3); // Should be exactly 3 steps
    },
    TEST_TIMEOUT,
  );

  it(
    'should handle errors during streaming',
    async () => {
      // Create an agent that will throw an error when processing certain input
      const errorAgent = new Agent({
        name: 'Error',
        instructions: 'You process information but sometimes encounter errors',
        model: openai('gpt-4o'),
      });

      // Create a network with a router that uses the error agent
      const network = new AgentNetwork({
        name: 'Error Network',
        agents: [errorAgent],
        routingModel: openai('gpt-4o'),
        maxSteps: 2,
      });

      // Spy on the agent's stream method to make it throw an error
      const originalStream = errorAgent.stream;
      errorAgent.stream = vi.fn().mockImplementationOnce(() => {
        throw new Error('Test error during streaming');
      });

      // Stream the network execution
      const streamResult = await network.stream('This will cause an error');

      // Collect all chunks from the stream
      const chunks: any[] = [];
      for await (const chunk of streamResult.stream) {
        chunks.push(chunk);
      }

      // Check for error events
      const errorEvents = chunks.filter(chunk => chunk.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].error).toContain('Test error');

      // Restore the original stream method
      errorAgent.stream = originalStream;
    },
    TEST_TIMEOUT,
  );
});
