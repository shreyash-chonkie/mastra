import { createOpenAI } from '@ai-sdk/openai';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Agent } from '../agent';
import { createTool } from '../tools';

import { AgentNetwork } from './network';
import { NetworkState } from './state';

config();

// Create OpenAI client
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

describe('AgentNetwork', () => {
  it('should create a network with agents', () => {
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

    // Create a network
    const network = new AgentNetwork({
      name: 'Research Assistant',
      agents: [searchAgent, summaryAgent],
      routingModel: openai('gpt-4o'),
    });

    expect(network).toBeDefined();
    expect(network.name).toBe('Research Assistant');
    expect(network.agents).toHaveLength(2);
    expect(network.agents[0].name).toBe('Search');
    expect(network.agents[1].name).toBe('Summary');
  });

  it('should run a network with a custom router', async () => {
    // Create a simple calculator tool
    const calculatorTool = createTool({
      id: 'calculator',
      description: 'Perform mathematical calculations',
      inputSchema: z.object({
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
        a: z.number(),
        b: z.number(),
      }),
      execute: async ({ context }) => {
        const { operation, a, b } = context;

        switch (operation) {
          case 'add':
            return a + b;
          case 'subtract':
            return a - b;
          case 'multiply':
            return a * b;
          case 'divide':
            return a / b;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      },
    });

    // Create math agent with calculator tool
    const mathAgent = new Agent({
      name: 'Math',
      instructions:
        'You solve math problems using the calculator tool. When asked to calculate, always use the calculator tool.',
      model: openai('gpt-4o'),
      tools: { calculatorTool },
    });

    // Create explanation agent
    const explanationAgent = new Agent({
      name: 'Explanation',
      instructions: 'You explain mathematical concepts and results in simple terms',
      model: openai('gpt-4o'),
    });

    // Create a network with a custom router that always uses mathAgent first, then explanationAgent
    const network = new AgentNetwork({
      name: 'Math Helper',
      agents: [mathAgent, explanationAgent],
      routingModel: openai('gpt-4o'),
      router: async ({ callCount }) => {
        if (callCount === 0) return mathAgent;
        if (callCount === 1) return explanationAgent;
        return undefined; // Done after two calls
      },
      maxSteps: 3, // Limit to 3 steps to be safe
    });

    // Run the network
    const result = await network.generate('Calculate 25 * 4 and explain the result');

    // Check the result
    expect(result).toBeDefined();
    expect(result.steps).toBe(2); // Should have run both agents
    expect(result.history).toHaveLength(2);
    expect(result.history[0].agent).toBe('Math');
    expect(result.history[1].agent).toBe('Explanation');
    expect(result.output).toBeDefined();
  }, 10000); // Increase timeout to 10 seconds

  it('should use NetworkState to maintain state between agent calls', async () => {
    // Create first agent that stores data
    const storeAgent = new Agent({
      name: 'DataStore',
      instructions: 'You store data provided by the user. Respond with "Data stored".',
      model: openai('gpt-4o'),
    });

    // Create second agent that retrieves data
    const retrieveAgent = new Agent({
      name: 'DataRetriever',
      instructions: 'You retrieve and display the data that was stored.',
      model: openai('gpt-4o'),
    });

    // Create initial state
    const initialState = new NetworkState();
    initialState.set('userData', { name: 'John Doe', age: 30 });

    // Create a network with a custom router
    const network = new AgentNetwork({
      name: 'Data Manager',
      agents: [storeAgent, retrieveAgent],
      routingModel: openai('gpt-4o'),
      initialState: initialState,
      router: async ({ callCount, state }) => {
        // First call: use storeAgent
        if (callCount === 0) {
          return storeAgent;
        }

        // Second call: use retrieveAgent
        if (callCount === 1) {
          // Verify state was maintained
          expect(state.get('userData')).toEqual({ name: 'John Doe', age: 30 });
          expect(state.get('lastAgent')).toBe('DataStore');

          return retrieveAgent;
        }

        return undefined; // Done after two calls
      },
    });

    // Run the network
    const result = await network.generate('Store my data and then retrieve it');

    // Check the result
    expect(result).toBeDefined();
    expect(result.steps).toBe(2);
    expect(result.state.get('userData')).toEqual({ name: 'John Doe', age: 30 });
    expect(result.state.get('lastAgent')).toBe('DataRetriever');
  }, 10000); // Increase timeout to 10 seconds

  it('should handle maximum steps and stop execution', async () => {
    // Create an agent that will always suggest continuing
    const loopAgent = new Agent({
      name: 'Loop',
      instructions: 'You always respond with "Let\'s continue the process"',
      model: openai('gpt-4o'),
    });

    // Create a network with a router that always returns the same agent
    const network = new AgentNetwork({
      name: 'Loop Test',
      agents: [loopAgent],
      routingModel: openai('gpt-4o'),
      router: async () => loopAgent, // Always return the same agent
      maxSteps: 3, // Set a low max steps count
    });

    // Run the network
    const result = await network.generate('This will loop');

    // Check that it stopped at the max steps
    expect(result.steps).toBe(3);
    expect(result.history).toHaveLength(3);
    expect(result.history.every(h => h.agent === 'Loop')).toBe(true);
  }, 10000); // Increase timeout to 10 seconds

  it('should pass the correct input to agents', async () => {
    // Create two agents
    const firstAgent = new Agent({
      name: 'First',
      instructions: 'You are the first agent. Always respond with "First agent response"',
      model: openai('gpt-4o'),
    });

    const secondAgent = new Agent({
      name: 'Second',
      instructions: 'You are the second agent. Always include the phrase "received from first agent" in your response',
      model: openai('gpt-4o'),
    });

    // Create a network with a router that uses both agents in sequence
    const network = new AgentNetwork({
      name: 'Input Test',
      agents: [firstAgent, secondAgent],
      routingModel: openai('gpt-4o'),
      router: async ({ callCount }) => {
        if (callCount === 0) return firstAgent;
        if (callCount === 1) return secondAgent;
        return undefined;
      },
    });

    const initialInput = 'Process this message';

    // Run the network
    const result = await network.generate(initialInput);

    // Check that the second agent's response references the first agent
    expect(result.history).toHaveLength(2);
    expect(result.history[0].agent).toBe('First');
    expect(result.history[1].agent).toBe('Second');

    // The output could be a string or an object with a text property
    const secondAgentOutput =
      typeof result.history[1].output === 'string' ? result.history[1].output : result.history[1].output.text;

    expect(secondAgentOutput.toLowerCase()).toContain('first agent');
  }, 10000); // Increase timeout to 10 seconds

  it('should handle errors gracefully', async () => {
    // Create a calculator tool that throws an error for division by zero
    const calculatorTool = createTool({
      id: 'calculator',
      description: 'Perform mathematical calculations',
      inputSchema: z.object({
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
        a: z.number(),
        b: z.number(),
      }),
      execute: async ({ context }) => {
        const { operation, a, b } = context;

        switch (operation) {
          case 'add':
            return a + b;
          case 'subtract':
            return a - b;
          case 'multiply':
            return a * b;
          case 'divide':
            if (b === 0) throw new Error('Division by zero');
            return a / b;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      },
    });

    // Create math agent with calculator tool
    const mathAgent = new Agent({
      name: 'Math',
      instructions:
        'You solve math problems using the calculator tool. When asked to calculate, always use the calculator tool.',
      model: openai('gpt-4o'),
      tools: { calculatorTool },
    });

    // Create error handler agent
    const errorHandlerAgent = new Agent({
      name: 'ErrorHandler',
      instructions: 'You handle errors in calculations and provide a friendly explanation of what went wrong.',
      model: openai('gpt-4o'),
    });

    // Create a network with error handling
    const network = new AgentNetwork({
      name: 'Error Handling Test',
      agents: [mathAgent, errorHandlerAgent],
      routingModel: openai('gpt-4o'),
      router: async ({ callCount, lastResult }) => {
        if (callCount === 0) return mathAgent;

        // If there was an error in the math agent, use the error handler
        if (typeof lastResult === 'string' && lastResult.includes('error')) {
          return errorHandlerAgent;
        }

        return undefined;
      },
    });

    // Run the network with a division by zero
    const result = await network.generate('Calculate 10 / 0');

    // Check that the error was handled
    expect(result.steps).toBeGreaterThanOrEqual(1);
    expect(result.history.length).toBeGreaterThanOrEqual(1);

    // If the error handler was used, check that it was the last agent
    if (result.history.length > 1) {
      expect(result.history[result.history.length - 1].agent).toBe('ErrorHandler');
    }
  }, 10000); // Increase timeout to 10 seconds

  it('should support complex state operations', async () => {
    // Create an agent that updates state
    const stateAgent = new Agent({
      name: 'StateUpdater',
      instructions:
        'You update state data. For the first call, respond with "Counter updated". For the second call, respond with "Items updated". For the third call, respond with "User preferences updated".',
      model: openai('gpt-4o'),
    });

    // Create initial complex state
    const initialState = new NetworkState();
    initialState.set('counter', 0);
    initialState.set('items', ['apple', 'banana']);
    initialState.set('user', { name: 'Alice', preferences: { theme: 'dark' } });

    // Create a router that updates state on each call
    const router = async ({ callCount, state }: { callCount: number; state: NetworkState }) => {
      if (callCount >= 3) return undefined;

      // Update state differently on each call
      if (callCount === 0) {
        state.set('counter', 1);
      } else if (callCount === 1) {
        const items = state.get<string[]>('items') || [];
        items.push('orange');
        state.set('items', items);
      } else if (callCount === 2) {
        const user = state.get<any>('user') || { preferences: { theme: 'dark' } };
        user.preferences.theme = 'light';
        state.set('user', user);
      }

      return stateAgent;
    };

    // Create the network
    const network = new AgentNetwork({
      name: 'State Operations',
      agents: [stateAgent],
      routingModel: openai('gpt-4o'),
      initialState,
      router,
    });

    // Run the network
    const result = await network.generate('Test complex state operations');

    // Verify state was updated correctly
    expect(result.state.get('counter')).toBe(1);
    expect(result.state.get<string[]>('items')).toEqual(['apple', 'banana', 'orange']);
    expect(result.state.get<any>('user').preferences.theme).toBe('light');
    expect(result.steps).toBe(3);
  }, 10000); // Increase timeout to 10 seconds

  it('should support running with custom runId and threadId', async () => {
    // Create an agent
    const testAgent = new Agent({
      name: 'TestAgent',
      instructions: 'You are a test agent that responds with the runId and threadId you receive',
      model: openai('gpt-4o'),
    });

    // Create a network
    const network = new AgentNetwork({
      name: 'Custom IDs Test',
      agents: [testAgent],
      routingModel: openai('gpt-4o'),
      router: async ({ callCount }) => (callCount === 0 ? testAgent : undefined),
    });

    // Custom IDs
    const customRunId = 'custom-run-id-123';
    const customThreadId = 'custom-thread-id-456';
    const customResourceId = 'custom-resource-id-789';

    // Run the network with custom IDs
    const result = await network.generate('Include the runId and threadId in your response', {
      runId: customRunId,
      threadId: customThreadId,
      resourceId: customResourceId,
    });

    // Verify the result contains information about the run
    expect(result.steps).toBe(1);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].agent).toBe('TestAgent');
  }, 10000); // Increase timeout to 10 seconds

  it('should respect maxSteps option at generate time', async () => {
    const loopAgent = new Agent({
      name: 'Loop',
      instructions: 'You always respond with "Let\'s continue the process"',
      model: openai('gpt-4o'),
    });

    // Create a network with a router that always returns the same agent
    const network = new AgentNetwork({
      name: 'MaxSteps Test',
      agents: [loopAgent],
      routingModel: openai('gpt-4o'),
      router: async () => loopAgent, // Always return the same agent
      maxSteps: 5, // Default max steps
    });

    // Run the network with a custom maxSteps that's lower than the default
    const result = await network.generate('This will loop', { maxSteps: 2 });

    // Check that it stopped at the specified maxSteps
    expect(result.steps).toBe(2);
    expect(result.history).toHaveLength(2);
    expect(result.history.every(h => h.agent === 'Loop')).toBe(true);
  });
});
