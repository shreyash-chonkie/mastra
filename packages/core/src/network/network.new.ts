import { Agent } from '@mastra/core/agent';
import type { LanguageModelV1 } from 'ai';
import { z } from 'zod';
import { MastraBase } from '../base';
import { createTool } from '../tools';
import { NetworkState } from './state';

interface CurrentNetworkState {
  state: NetworkState;
  lastResult: any;
  callCount: number;
  input: string;
}

export class AgentNetwork extends MastraBase {
  state: NetworkState;
  agents: Agent[];
  model: LanguageModelV1;
  current_state?: CurrentNetworkState;

  constructor(config: any) {
    super({ component: 'AGENT', name: 'NETWORK' });
    this.state = new NetworkState({});
    this.agents = config.agents;
    this.model = config.model;
  }

  setCurrentState(state: CurrentNetworkState) {
    this.current_state = state;
  }

  getInstructions() {
    const agentDescriptions = this.agents.map(agent => ({
      name: agent.name,
      description: agent.instructions,
    }));

    return `
            You are a router in a network of specialized agents. Your job is to decide which agent should handle the next step or if the task is complete.

            Available agents as tool calls:
            ${agentDescriptions.map(a => `- ${a.name}`).join('\n')}

            Based on the above information, decide which agent should be called next or if the task is complete.
            
            WORKFLOW:
            1. Use the getNetworkState tool to check the current state of the network, including any previous agent results
            2. Assess the current state and determine if you need to call an agent or if the task is complete
            3. If you need to call an agent, execute the agent as a tool call with the appropriate message
            4. After receiving the agent's response, use getNetworkState again to see the updated network state
            5. Assess if the task is now complete or if another agent needs to be called
            6. If the task is complete, provide a final comprehensive answer based on all the information gathered from the agents
            7. If another agent is needed, execute that agent as a tool call
        `;
  }

  async buildRouter() {
    // Create tools from agents with state tracking
    const agentAsTools = this.agents.reduce<Record<string, any>>(
      (memo, agent) => {
        memo[agent.name] = createTool({
          id: agent.name,
          description: agent.instructions,
          inputSchema: z.object({ message: z.string() }),
          outputSchema: z.object({ message: z.string() }),
          execute: async ({ context }) => {
            console.log('Executing agent', agent.name);

            // Generate response from the agent
            const result = await agent.generate(context.message);

            // Update network state with this agent's result
            if (this.current_state) {
              this.current_state.lastResult = result.text;
              this.current_state.callCount += 1;

              // Store the result in the state object as well
              this.current_state.state.set(agent.name + '_result', result.text);
            }

            console.log(`${agent.name} result:`, result.text.substring(0, 100) + '...');
            return { message: result.text };
          },
        });
        return memo;
      },
      {} as Record<string, any>,
    );

    // Create the router agent with the tools
    return new Agent({
      name: 'Router',
      model: this.model,
      instructions: this.getInstructions(),
      tools: {
        ...agentAsTools,
        getNetworkState: createTool({
          id: 'getNetworkState',
          description: 'Get the current state of the agent network, including previous agent results and call history',
          inputSchema: z.object({}),
          outputSchema: z.object({ state: z.any() }),
          execute: async () => {
            console.log('Getting network state');
            // Return the current network state in a structured format
            const stateObj = this.current_state?.state.toObject() || {};
            const agentResults = {};

            // Extract agent results from state
            for (const key in stateObj) {
              if (key.endsWith('_result')) {
                agentResults[key] = stateObj[key];
              }
            }

            return {
              state: {
                callCount: this.current_state?.callCount || 0,
                lastResult: this.current_state?.lastResult || '',
                input: this.current_state?.input || '',
                agentResults,
                stateData: stateObj,
              },
            };
          },
        }),
      },
    });
  }

  async generate(messages: string) {
    try {
      // Initialize state if not already set
      if (!this.current_state) {
        this.setCurrentState({
          state: new NetworkState({}),
          lastResult: '',
          callCount: 0,
          input: messages,
        });
      }

      // Build router with current state
      const router = await this.buildRouter();

      // Get response from router
      const result = await router.generate(messages, {
        maxSteps: 20,
      });

      // Update state with the result
      if (this.current_state) {
        this.current_state.lastResult = result.text;
        this.current_state.callCount += 1;
      }

      return result;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async stream(messages: string) {
    try {
      // Initialize state if not already set
      if (!this.current_state) {
        this.setCurrentState({
          state: new NetworkState({}),
          lastResult: '',
          callCount: 0,
          input: messages,
        });
      }

      // Build router with current state
      const router = await this.buildRouter();

      // Get streaming response from router
      const streamResult = await router.stream(messages);

      // Update state (note: we can't access the full text yet as it's streaming)
      if (this.current_state) {
        this.current_state.callCount += 1;
      }

      return streamResult;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
