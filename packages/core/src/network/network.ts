import { randomUUID } from 'crypto';
import type { LanguageModelV1, CoreMessage } from 'ai';
import { createDataStream } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import { Agent } from '../agent';
import { MastraBase } from '../base';
import type { MastraLLMBase } from '../llm/model/base';
import { MastraLLM } from '../llm/model/model';
import { RegisteredLogger } from '../logger';
import { InstrumentClass } from '../telemetry';

import type {
  NetworkConfig,
  NetworkResult,
  NetworkOptions,
  RouterFunction,
  RouterState,
  NetworkStreamOptions,
  NetworkStreamResult,
  NetworkStepResult,
} from './types';
import { NetworkState } from './state';

/**
 * AgentNetwork class for orchestrating multiple agents
 */
@InstrumentClass({
  prefix: 'network',
  excludeMethods: ['__setLogger', '__setTelemetry'],
})
export class AgentNetwork<TAgents extends Agent[] = Agent[]> extends MastraBase {
  public name: string;
  public agents: TAgents;
  private routingModel: LanguageModelV1;
  private router: RouterFunction<TAgents>;
  private defaultMaxSteps: number;
  private initialState: NetworkState;
  private llm: MastraLLMBase;

  constructor(config: NetworkConfig<TAgents>) {
    super({ component: RegisteredLogger.AGENT, name: config.name });

    this.name = config.name;
    this.agents = config.agents;
    this.routingModel = config.routingModel;
    this.defaultMaxSteps = config.maxSteps || 10; // Default to 10 steps max
    this.initialState = config.initialState || new NetworkState();

    // Create LLM for routing decisions
    this.llm = new MastraLLM({ model: config.routingModel, mastra: config.mastra });

    this.router = this.createDefaultRouter();

    // Register primitives if provided
    if (config.mastra) {
      if (config.mastra.logger) {
        this.__setLogger(config.mastra.logger);
      }
      if (config.mastra.telemetry) {
        this.__setTelemetry(config.mastra.telemetry);
      }
    }
  }

  /**
   * Create a default router that uses the LLM to decide which agent to run next
   */
  private createDefaultRouter(): RouterFunction<TAgents> {
    return async (routerState: RouterState) => {
      // If this is the first call, use the first agent
      if (routerState.callCount === 0) {
        return this.agents[0];
      }

      // Use LLM to decide which agent to use next or if we're done
      const agentDescriptions = this.agents.map(agent => ({
        name: agent.name,
        description: agent.instructions,
      }));

      const prompt = `
You are a router in a network of specialized agents. Your job is to decide which agent should handle the next step or if the task is complete.

Available agents:
${agentDescriptions.map(a => `- ${a.name}: ${a.description}`).join('\n')}

Current state:
${JSON.stringify(routerState.state.toObject(), null, 2)}

Last result:
${JSON.stringify(routerState.lastResult, null, 2)}

Call count: ${routerState.callCount}

Based on the above information, decide which agent should be called next or if the task is complete.
If the task is complete, respond with "DONE".
If another agent should be called, respond with the agent's name exactly as listed above.
`;

      const result = await this.llm.generate(prompt);
      console.log('LLM Result:', result.text);
      const content = result.text.trim();

      if (content === 'DONE') {
        return undefined;
      }

      // Find the agent with the matching name
      return this.agents.find(agent => agent.name === content);
    };
  }

  /**
   * Generate a response from the network with the given input
   * @param input - Input prompt or message to start the network with
   * @param options - Optional parameters for the network run
   */
  async generate(input: string | CoreMessage[], options: NetworkOptions = {}): Promise<NetworkResult> {
    const runId = options.runId || randomUUID();
    const resourceId = options.resourceId || randomUUID();
    const threadId = options.threadId || randomUUID();
    const state = options.initialState || this.initialState.clone();
    const maxSteps = options.maxSteps !== undefined ? options.maxSteps : this.defaultMaxSteps;

    let callCount = 0;
    let lastResult: any = null;
    const history: NetworkResult['history'] = [];

    this.logger.info(`Starting network run`, {
      networkName: this.name,
      runId,
      threadId,
    });

    try {
      // Main execution loop
      while (callCount < maxSteps) {
        // Create router state
        const routerState: RouterState = {
          state,
          lastResult,
          callCount,
          input,
        };

        // Get next agent from router
        const nextAgent = await this.router(routerState);

        // If no agent is returned, we're done
        if (!nextAgent) {
          this.logger.info(`Network run complete - router returned no agent`, {
            networkName: this.name,
            runId,
            steps: callCount,
          });
          break;
        }

        this.logger.info(`Running agent in network`, {
          networkName: this.name,
          agentName: nextAgent.name,
          runId,
          step: callCount,
        });

        // Prepare input for the agent
        let agentInput: string | CoreMessage[];

        if (callCount === 0) {
          // For the first call, use the original input
          agentInput = input;
        } else {
          // For subsequent calls, include the previous result
          const inputContent =
            typeof input === 'string'
              ? input
              : Array.isArray(input)
                ? input.map(m => m.content).join('\n')
                : String(input);

          agentInput = `Previous result: ${JSON.stringify(lastResult)}\n\nCurrent task: ${inputContent}`;
        }

        // Run the agent
        let agentResult: string = '';

        try {
          // If input is a CoreMessage[] array, pass it directly
          if (Array.isArray(agentInput) && agentInput.length > 0 && agentInput?.[0] && 'role' in agentInput[0]) {
            agentResult = (
              await nextAgent.generate(agentInput, {
                runId,
                resourceId,
                threadId,
              })
            ).text;
          } else {
            // Otherwise, convert to string if needed
            const stringInput = typeof agentInput === 'string' ? agentInput : JSON.stringify(agentInput);

            agentResult = (
              await nextAgent.generate(stringInput, {
                runId,
                resourceId,
                threadId,
              })
            ).text;
          }
        } catch (error) {
          this.logger.error(`Error in agent execution`, {
            networkName: this.name,
            agentName: nextAgent.name,
            runId,
            error,
          });

          if (error instanceof Error) {
            // Convert the error to a string result so we can continue
            agentResult = `Error: ${error.message || 'Unknown error in agent execution'}`;
          }
        }

        // Store result
        lastResult = agentResult;

        // Update state with agent result
        state.update({
          [`agent_${nextAgent.name}_result`]: agentResult,
          lastResult: agentResult,
          lastAgent: nextAgent.name,
        });

        // Add to history
        history.push({
          agent: nextAgent.name,
          input: agentInput,
          output: agentResult,
          timestamp: Date.now(),
        });

        // Increment call count
        callCount++;
      }

      // If we reached max steps, log a warning
      if (callCount >= maxSteps) {
        this.logger.warn(`Network run reached maximum steps`, {
          networkName: this.name,
          runId,
          maxSteps,
        });
      }

      return {
        state,
        output: lastResult,
        steps: callCount,
        history,
      };
    } catch (error) {
      this.logger.error(`Error in network run`, {
        networkName: this.name,
        runId,
        error,
      });

      throw error;
    }
  }

  /**
   * Stream a response from the network with the given input
   * @param input - Input prompt or message to start the network with
   * @param options - Optional parameters for the network stream
   */
  public stream(input: string | CoreMessage[], options: NetworkStreamOptions = {}): NetworkStreamResult {
    const {
      runId = randomUUID(),
      resourceId = randomUUID(),
      threadId = randomUUID(),
      maxSteps = options.maxSteps ?? this.defaultMaxSteps,
      onStepStart,
      onStepFinish,
    } = options;

    // Create a data stream for the network execution
    const stream = createDataStream({
      execute: async dataStream => {
        try {
          // Initialize network state
          const state = new NetworkState();

          // Execute the network with streaming
          const result = await this.executeNetworkWithStream(input, {
            runId,
            resourceId,
            threadId,
            state,
            maxSteps,
            onStepStart,
            onStepFinish,
            dataStream,
          });

          return result.output;
        } catch (error) {
          this.logger.error(`Error in network stream`, {
            networkName: this.name,
            runId,
            error,
          });

          throw error;
        }
      },
      onError: error => {
        this.logger.error(`Error in network stream`, {
          networkName: this.name,
          runId,
          error,
        });

        return `Error: ${error instanceof Error ? error.message : 'Unknown error in network execution'}`;
      },
    });

    return {
      textStream: stream,
      text: stream.text(),
    };
  }

  /**
   * Execute the network with streaming updates
   * @private
   */
  private async executeNetworkWithStream(
    input: string | CoreMessage[],
    options: {
      runId: string;
      resourceId: string;
      threadId: string;
      state: NetworkState;
      maxSteps: number;
      onStepStart?: (agent: Agent, step: number) => void;
      onStepFinish?: (result: NetworkStepResult) => void;
      dataStream: {
        writeData: (data: any) => Promise<void> | void;
        error: (error: Error) => void;
      };
    },
  ): Promise<NetworkResult> {
    const { runId, resourceId, threadId, state, maxSteps, onStepStart, onStepFinish, dataStream } = options;

    let callCount = 0;
    let lastResult: any = null;
    const history: NetworkResult['history'] = [];

    this.logger.info(`Starting network stream`, {
      networkName: this.name,
      runId,
      threadId,
    });

    try {
      // Main execution loop
      while (callCount < maxSteps) {
        // Create router state
        const routerState: RouterState = {
          state,
          lastResult,
          callCount,
          input,
        };

        // Get next agent from router
        const nextAgent = await this.router(routerState);

        // If no agent is returned, we're done
        if (!nextAgent) {
          this.logger.info(`Network stream complete - router returned no agent`, {
            networkName: this.name,
            runId,
            steps: callCount,
          });

          // Write the final result to the stream
          await dataStream.writeData({
            type: 'complete',
            text: lastResult,
            steps: callCount,
            history,
          });

          break;
        }

        this.logger.info(`Running agent in network stream`, {
          networkName: this.name,
          agentName: nextAgent.name,
          runId,
          step: callCount,
        });

        // Notify that a step is starting
        if (onStepStart) {
          onStepStart(nextAgent, callCount);
        }

        // Write the step start to the stream
        await dataStream.writeData({
          type: 'stepStart',
          agent: nextAgent.name,
          step: callCount,
        });

        // Prepare input for the agent
        let agentInput: string | CoreMessage[];

        if (callCount === 0) {
          // For the first call, use the original input
          agentInput = input;
        } else {
          // For subsequent calls, include the previous result
          const inputContent =
            typeof input === 'string'
              ? input
              : Array.isArray(input)
                ? input.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n')
                : String(input);

          agentInput = `Previous result: ${JSON.stringify(lastResult)}\n\nCurrent task: ${inputContent}`;
        }

        // Run the agent
        let agentResult;

        try {
          // Create a data stream for the agent step
          const agentStep = createDataStream({
            execute: async agentDataStream => {
              // If input is a CoreMessage[] array, pass it directly
              if (Array.isArray(agentInput) && agentInput.length > 0 && agentInput?.[0] && 'role' in agentInput[0]) {
                // Use stream instead of generate to get real-time updates
                const streamResult = await nextAgent.stream(agentInput, {
                  runId,
                  resourceId,
                  threadId,
                });

                agentDataStream.merge(streamResult);

                // Forward the agent's stream chunks to our stream
                for await (const chunk of streamResult.textStream) {
                  const chunkData = {
                    type: 'agentChunk',
                    agent: nextAgent.name,
                    chunk,
                    step: callCount,
                  };

                  dataStream.writeData(chunkData);
                  // Also write to the agent data stream
                  agentDataStream.writeData(chunk);
                }

                return await streamResult.text;
              } else {
                // Otherwise, convert to string if needed and stream
                const stringInput = typeof agentInput === 'string' ? agentInput : JSON.stringify(agentInput);

                const streamResult = await nextAgent.stream(stringInput, {
                  runId,
                  resourceId,
                  threadId,
                });

                // Forward the agent's stream chunks to our stream
                for await (const chunk of streamResult.textStream) {
                  const chunkData = {
                    type: 'agentChunk',
                    agent: nextAgent.name,
                    chunk,
                    step: callCount,
                  };

                  dataStream.writeData(chunkData);
                  // Also write to the agent data stream
                  agentDataStream.writeData(chunk);
                }

                return await streamResult.text;
              }
            },
            onError: error => {
              // This is called when the execute function throws an error
              return `Error: ${error instanceof Error ? error.message : 'Unknown error in agent execution'}`;
            },
          });

          // Get the final result from the agent data stream
          const reader = agentStep.getReader();
          let agentResultText = '';

          // Read all chunks from the stream
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Accumulate the text
            if (typeof value === 'string') {
              agentResultText += value;
            }
          }

          agentResult = agentResultText;
        } catch (error) {
          this.logger.error(`Error in agent execution during stream`, {
            networkName: this.name,
            agentName: nextAgent.name,
            runId,
            error,
          });

          // Convert the error to a string result so we can continue
          agentResult = `Error: ${error instanceof Error ? error.message : 'Unknown error in agent execution'}`;
        }

        // Store result
        lastResult = agentResult;

        // Update state with agent result
        state.update({
          [`agent_${nextAgent.name}_result`]: agentResult,
          lastResult: agentResult,
          lastAgent: nextAgent.name,
        });

        // Create the step result
        const stepResult: NetworkStepResult = {
          agent: nextAgent.name,
          input: agentInput,
          output: agentResult,
          timestamp: Date.now(),
          step: callCount,
          state: state.clone(),
        };

        // Add to history
        history.push({
          agent: nextAgent.name,
          input: agentInput,
          output: agentResult,
          timestamp: Date.now(),
        });

        // Write the step finish to the stream
        await dataStream.writeData({
          type: 'stepFinish',
          result: stepResult,
        });

        // Notify that a step is finished
        if (onStepFinish) {
          onStepFinish(stepResult);
        }

        // Increment call count
        callCount++;
      }

      // If we reached max steps, log a warning
      if (callCount >= maxSteps) {
        this.logger.warn(`Network stream reached maximum steps`, {
          networkName: this.name,
          runId,
          maxSteps,
        });

        // Write the max steps warning to the stream
        await dataStream.writeData({
          type: 'warning',
          message: `Network reached maximum steps (${maxSteps})`,
        });
      }

      // Return the final result
      return {
        state,
        output: lastResult,
        steps: callCount,
        history,
      };
    } catch (error) {
      this.logger.error(`Error in network stream execution`, {
        networkName: this.name,
        runId,
        error,
      });

      throw error;
    }
  }
}
