import { describe, it, expect } from 'vitest';
import { AgentNetwork } from './network.new';
import { Agent } from '../agent';
import { NetworkState } from './state';
import { openai } from '@ai-sdk/openai';
import { config } from 'dotenv';

config();

const routingModel = openai('gpt-4o');
const agentModel = openai('gpt-4o-mini');

const agents = [
  new Agent({
    name: 'SearchAgent',
    model: agentModel,
    instructions:
      'You search for factual information about topics. When asked about a topic, provide key facts and history.',
  }),
  new Agent({
    name: 'AnalysisAgent',
    model: agentModel,
    instructions:
      'You analyze information and provide insights. When given facts about a topic, analyze trends, implications, and provide a deeper understanding.',
  }),
  new Agent({
    name: 'ComparisonAgent',
    model: agentModel,
    instructions:
      'You compare different aspects of a topic. When given information about a topic, compare different varieties, brands, or approaches.',
  }),
  new Agent({
    name: 'SummaryAgent',
    model: agentModel,
    instructions:
      'You create concise summaries. When given detailed information, create a brief, easy-to-understand summary highlighting the most important points.',
  }),
];

describe('AgentNetwork', () => {
  const network = new AgentNetwork({
    agents: agents,
    model: routingModel,
  });

  it('should initialize with the correct properties', () => {
    expect(network.agents).toEqual(agents);
    expect(network.model).toEqual(routingModel);
    expect(network.state).toBeInstanceOf(NetworkState);
  });

  it('should set and use current state', () => {
    const testState = {
      state: new NetworkState({ testKey: 'testValue' }),
      lastResult: 'previous result',
      callCount: 2,
      input: 'test input',
    };

    network.setCurrentState(testState);

    expect(network.current_state).toEqual(testState);

    // Check that instructions include the state information
    const instructions = network.getInstructions();
    expect(instructions).toContain('testKey');
    expect(instructions).toContain('previous result');
    expect(instructions).toContain('Call count: 2');
  });

  it('should build a router agent with the correct instructions', async () => {
    const router = await network.buildRouter();

    expect(router.name).toBe('Router');
    expect(router.instructions).toContain('You are a router in a network of specialized agents');
    expect(router.instructions).toContain('SearchAgent');
    expect(router.instructions).toContain('AnalysisAgent');
  });

  it.only('should generate responses through multiple agents', async () => {
    // Set up network state to track agent calls
    network.setCurrentState({
      state: new NetworkState({}),
      lastResult: '',
      callCount: 0,
      input:
        'I need a comprehensive analysis of different soda brands, their ingredients, market trends, and a summary of which ones might be healthiest.',
    });

    // This query should trigger multiple agents in sequence:
    // 1. SearchAgent to find information about soda brands
    // 2. AnalysisAgent to analyze the ingredients and trends
    // 3. ComparisonAgent to compare different brands
    // 4. SummaryAgent to provide a final summary
    const result = await network.generate(
      'I need a comprehensive analysis of different soda brands, their ingredients, market trends, and a summary of which ones might be healthiest.',
    );

    console.log('FINAL RESULT:', result.text);

    // The result should contain a comprehensive answer that incorporates information from multiple agents
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(200); // A comprehensive answer should be substantial

    // Log the call count to verify multiple agents were used
    console.log(`Final call count: ${network.current_state?.callCount}`);

    // The answer should contain information about different soda brands, ingredients, and health aspects
    expect(result.text.toLowerCase()).toMatch(/coca-cola|pepsi|soda|ingredient|sugar|health/);
  }, 60000); // Increased timeout for multiple agent calls

  // it('should stream responses through multiple agents', async () => {
  //     // Set up network state to track agent calls
  //     network.setCurrentState({
  //         state: new NetworkState({}),
  //         lastResult: '',
  //         callCount: 0,
  //         input: 'Compare Coca-Cola and Pepsi, analyze their ingredients, and summarize which might be healthier.'
  //     });

  //     // This should trigger multiple agents in sequence with streaming output
  //     const streamResult = await network.stream('Compare Coca-Cola and Pepsi, analyze their ingredients, and summarize which might be healthier.');

  //     const chunks: any[] = [];
  //     console.log('\n--- STREAMING OUTPUT START ---');
  //     for await (const chunk of streamResult.textStream) {
  //         console.log('Received chunk:', chunk);
  //         process.stdout.write(chunk);
  //         chunks.push(chunk);
  //     }
  //     console.log('\n--- STREAMING OUTPUT END ---');
  //     console.log(`Total chunks received: ${chunks.length}`);

  //     // We should receive at least some chunks
  //     expect(chunks.length).toBeGreaterThan(0);
  // }, 60000)
});
