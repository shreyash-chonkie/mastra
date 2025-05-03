import { openai } from '@ai-sdk/openai';
import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { RuntimeContext } from '../runtime-context';
import { NewWorkflow } from '../workflows/vNext';
import { AgentNetwork } from './network-new';

describe('AgentNetwork', () => {
  // Test agents
  let agent1: Agent;
  let agent2: Agent;
  let agentsRecord: Record<string, Agent>;

  // Use a real model
  const routerModel = openai('gpt-3.5-turbo');

  // Sample instructions
  const instructions = 'Route tasks to the appropriate agent';

  beforeEach(() => {
    // Create test agents with real models
    agent1 = new Agent({
      name: 'agent1',
      description: 'Research assistant',
      instructions: 'You are a helpful research assistant that finds information.',
      model: openai('gpt-3.5-turbo'),
    });

    agent2 = new Agent({
      name: 'agent2',
      description: 'Creative writer',
      instructions: 'You are a creative writer that helps craft stories and content.',
      model: openai('gpt-3.5-turbo'),
    });

    // Create a record of agents
    agentsRecord = {
      agent1: agent1,
      agent2: agent2,
    };
  });

  describe('constructor', () => {
    it('should create an instance with static values', () => {
      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: routerModel,
        instructions,
      });

      expect(network).toBeInstanceOf(AgentNetwork);
    });

    it('should create an instance with dynamic values', () => {
      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: () => agentsRecord,
        model: () => routerModel,
        instructions: () => instructions,
      });

      expect(network).toBeInstanceOf(AgentNetwork);
    });
  });

  describe('getAgents', () => {
    it('should return static agents', async () => {
      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: routerModel,
        instructions,
      });

      const agents = await network.getAgents({});
      expect(Object.keys(agents)).toHaveLength(2);
      expect(agents['agent1']).toBe(agent1);
      expect(agents['agent2']).toBe(agent2);
    });

    it('should return dynamic agents', async () => {
      const getAgentsSpy = () => agentsRecord;

      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: getAgentsSpy,
        model: routerModel,
        instructions,
      });

      const runtimeContext = new RuntimeContext();
      const agents = await network.getAgents({ runtimeContext });

      // Since we're using real functions, not mocks, we just verify the result
      expect(Object.keys(agents)).toHaveLength(2);
      expect(agents['agent1']).toBe(agent1);
      expect(agents['agent2']).toBe(agent2);
    });
  });

  describe('getModel', () => {
    it('should return static model', async () => {
      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: routerModel,
        instructions,
      });

      const returnedModel = await network.getModel({});
      expect(returnedModel).toBe(routerModel);
    });

    it('should return dynamic model', async () => {
      const getModelSpy = () => routerModel;

      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: getModelSpy,
        instructions,
      });

      const runtimeContext = new RuntimeContext();
      const returnedModel = await network.getModel({ runtimeContext });

      // Since we're using real functions, not mocks, we just verify the result
      expect(returnedModel).toBe(routerModel);
    });
  });

  describe('getInstructions', () => {
    it('should return static instructions', async () => {
      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: routerModel,
        instructions,
      });

      const returnedInstructions = await network.getInstructions({});
      expect(returnedInstructions).toBe(instructions);
    });

    it('should return dynamic instructions', async () => {
      const getInstructionsSpy = () => instructions;

      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: routerModel,
        instructions: getInstructionsSpy,
      });

      const runtimeContext = new RuntimeContext();
      const returnedInstructions = await network.getInstructions({ runtimeContext });

      // Since we're using real functions, not mocks, we just verify the result
      expect(returnedInstructions).toBe(instructions);
    });
  });

  describe('getRoutingAgent', () => {
    it('should create a routing agent with static values', async () => {
      const networkName = 'RoutingNetwork';
      const network = new AgentNetwork({
        name: networkName,
        agents: agentsRecord,
        model: routerModel,
        instructions,
      });

      const routingAgent = await network.getRoutingAgent({});

      // Verify the agent was created with the correct properties
      expect(routingAgent).toBeInstanceOf(Agent);
      expect(routingAgent.name).toBe(networkName);

      // Verify the agent has instructions that include our user instructions
      const agentInstructions = await routingAgent.getInstructions({});
      expect(agentInstructions).toContain(instructions);
      expect(agentInstructions).toContain('You are a strategic routing agent');
      expect(agentInstructions).toContain('ROUTING RESPONSIBILITIES');

      // Verify the agent has the correct model
      const agentModel = await routingAgent.getModel({});
      expect(agentModel).toBe(routerModel);
    });

    it('should create a routing agent with dynamic values', async () => {
      const networkName = 'DynamicRoutingNetwork';
      const dynamicInstructions = 'Dynamic routing instructions';
      const dynamicModel = openai('gpt-4');

      const network = new AgentNetwork({
        name: networkName,
        agents: agentsRecord,
        model: () => dynamicModel,
        instructions: () => dynamicInstructions,
      });

      const runtimeContext = new RuntimeContext();
      const routingAgent = await network.getRoutingAgent({ runtimeContext });

      // Verify the agent was created with the correct properties
      expect(routingAgent).toBeInstanceOf(Agent);
      expect(routingAgent.name).toBe(networkName);

      // Verify the agent has instructions that include our dynamic instructions
      const agentInstructions = await routingAgent.getInstructions({});
      expect(agentInstructions).toContain(dynamicInstructions);
      expect(agentInstructions).toContain('You are a strategic routing agent');
      expect(agentInstructions).toContain('ROUTING RESPONSIBILITIES');

      // Verify the agent has the correct model
      const agentModel = await routingAgent.getModel({});
      expect(agentModel).toBe(dynamicModel);
    });
  });

  describe('getNetworkWorkflow', () => {
    it('should create a workflow with routing agent step', async () => {
      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: routerModel,
        instructions,
      });

      const workflow = network.getNetworkWorkflow();

      // Verify the workflow was created correctly
      expect(workflow).toBeInstanceOf(NewWorkflow);

      expect(workflow).toBeDefined();
      expect(workflow.id).toContain('control-workflow');
    });
  });

  describe('generate', () => {
    it('should execute the workflow with the provided message', async () => {
      // Create a network with real agents
      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: routerModel,
        instructions,
      });

      // Call the generate method with a real message
      const message = 'What is the capital of France?';
      const result = await network.generate(message);

      console.log(result);

      // Verify we got a result back
      expect(result).toBeDefined();
    });

    it('should use the provided runId if specified', async () => {
      // Create a network with real agents
      const network = new AgentNetwork({
        name: 'TestNetwork',
        agents: agentsRecord,
        model: routerModel,
        instructions,
      });

      // Call the generate method with a custom runId
      const message = 'What is the capital of Germany?';
      const customRunId = 'custom-run-id-' + Date.now();
      const result = await network.generate(message, { runId: customRunId });

      console.log(result);

      // Verify we got a result back
      expect(result).toBeDefined();
    });
  });

  describe.only('Supervisor example (better than Langchain)', () => {
    it('should route tasks between specialized agents', async () => {
      // Create specialized agents

      // Joke Generator Agent
      const jokeAgent = new Agent({
        name: 'joke_agent',
        description: 'Expert at creating jokes and humor content',
        instructions: 'You are a world-class joke writer. Create funny, clever jokes based on the request.',
        model: openai('gpt-3.5-turbo'),
      });

      // Research Expert Agent
      const researchAgent = new Agent({
        name: 'research_agent',
        description: 'Expert at researching factual information',
        instructions: 'You are a world-class researcher. Provide accurate, factual information based on the request.',
        model: openai('gpt-3.5-turbo'),
      });

      // Create a record of specialized agents
      const specializedAgents = {
        joke_agent: jokeAgent,
        research_agent: researchAgent,
      };

      // Create the supervisor network
      const supervisorNetwork = new AgentNetwork({
        name: 'SupervisorNetwork',
        agents: specializedAgents,
        model: openai('gpt-4o'),
        instructions:
          'You are a team supervisor managing a research expert and a joke expert. ' +
          'For factual information and research, use research_agent. ' +
          'For jokes and humor, use joke_agent.',
      });

      // Test with a joke request
      const jokeRequest = 'Share a joke to relax before my next project idea.';
      const jokeResult = await supervisorNetwork.generate(jokeRequest);

      console.log('Joke Request Result:', jokeResult);
      expect(jokeResult).toBeDefined();
      // Check if the result has the expected structure
      if (jokeResult.status === 'success') {
        expect(jokeResult.result.agentId).toBe('joke_agent'); // Should route to joke agent
      }

      // // Test with a research request
      // const researchRequest = 'What are the employee counts for major tech companies in 2024?';
      // const researchResult = await supervisorNetwork.generate(researchRequest);

      // console.log('Research Request Result:', researchResult);
      // expect(researchResult).toBeDefined();
      // // Check if the result has the expected structure
      // if (researchResult.status === 'success') {
      //   expect(researchResult.result.agentId).toBe('research_agent'); // Should route to research agent
      // }

      // // Test with a mixed request that requires multiple agents
      // const mixedRequest = 'Tell me a joke about software engineers and then explain why debugging is important.';
      // const mixedResult = await supervisorNetwork.generate(mixedRequest);

      // console.log('Mixed Request Result:', mixedResult);
      // expect(mixedResult).toBeDefined();
    }, 100000);
  });
});
