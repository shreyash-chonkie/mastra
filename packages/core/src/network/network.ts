import { randomUUID } from 'crypto';
import type { LanguageModelV1, CoreMessage } from 'ai';
import { streamText } from 'ai';
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
  NetworkRunOptions,
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

    // Set up router function
    if (config.router) {
      this.router = config.router;
    } else {
      // Default router uses the LLM to decide which agent to use
      this.router = this.createDefaultRouter();
    }

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
      const content = result.text.trim();

      if (content === 'DONE') {
        return undefined;
      }

      // Find the agent with the matching name
      return this.agents.find(agent => agent.name === content);
    };
  }

  /**
   * Run the network with the given input
   * @deprecated Use generate() instead
   */
  async run(options: NetworkRunOptions): Promise<NetworkResult> {
    return this.generate(options.input, {
      runId: options.runId,
      resourceId: options.resourceId,
      threadId: options.threadId,
      initialState: options.initialState,
    });
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
        let agentResult;

        try {
          // If input is a CoreMessage[] array, pass it directly
          if (Array.isArray(agentInput) && agentInput.length > 0 && 'role' in agentInput[0]) {
            agentResult = await nextAgent.generate(agentInput, {
              runId,
              resourceId,
              threadId,
            });
          } else {
            // Otherwise, convert to string if needed
            const stringInput = typeof agentInput === 'string' ? agentInput : JSON.stringify(agentInput);

            agentResult = await nextAgent.generate(stringInput, {
              runId,
              resourceId,
              threadId,
            });
          }
        } catch (error) {
          this.logger.error(`Error in agent execution`, {
            networkName: this.name,
            agentName: nextAgent.name,
            runId,
            error,
          });

          // Convert the error to a string result so we can continue
          agentResult = `Error: ${error.message || 'Unknown error in agent execution'}`;
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
  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    input: string | CoreMessage[],
    options: NetworkStreamOptions<Z> = {},
  ): Promise<NetworkStreamResult<Z>> {
    const runId = options.runId || randomUUID();
    const resourceId = options.resourceId || randomUUID();
    const threadId = options.threadId || randomUUID();
    const state = options.initialState || this.initialState.clone();
    const maxSteps = options.maxSteps !== undefined ? options.maxSteps : this.defaultMaxSteps;
    const { onStepStart, onStepFinish, onFinish } = options;

    // Create a readable stream for the network execution
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Store chunks for the done method
    const storedChunks: any[] = [];

    // Create a transformed readable stream that stores chunks
    const { readable: transformedReadable, writable: transformedWritable } = new TransformStream({
      transform(chunk, controller) {
        // Store the chunk
        storedChunks.push(chunk);
        // Pass it through
        controller.enqueue(chunk);
      },
    });

    // Pipe the original readable to the transformed writable
    readable.pipeTo(transformedWritable).catch(error => {
      console.error('Error piping stream:', error);
    });

    // Start the network execution in the background
    this.executeNetworkWithStream(input, {
      runId,
      resourceId,
      threadId,
      state,
      maxSteps,
      onStepStart,
      onStepFinish,
      writer,
    })
      .then(result => {
        // When the network execution is complete, call the onFinish callback
        if (onFinish) {
          onFinish(result);
        }

        // Close the stream
        writer.close();
      })
      .catch(error => {
        this.logger.error(`Error in network stream`, {
          networkName: this.name,
          runId,
          error,
        });

        // Write the error to the stream and close it
        writer.write({ type: 'error', error: error.message || 'Unknown error' });
        writer.close();
      });

    // Return the stream result
    return {
      stream: transformedReadable,
      // Add the done method to get the final result
      done: async () => {
        // Wait a short time to ensure all chunks are processed
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('Stored chunks:', storedChunks.length);

        // Return the final result (the last complete chunk or empty string)
        const completeChunks = storedChunks.filter(chunk => chunk.type === 'complete');
        if (completeChunks.length > 0) {
          const lastCompleteChunk = completeChunks[completeChunks.length - 1];
          return lastCompleteChunk.text || '';
        }

        // If no complete chunks, try to extract text from the last step finish event
        const stepFinishChunks = storedChunks.filter(chunk => chunk.type === 'stepFinish');
        if (stepFinishChunks.length > 0) {
          const lastStepFinish = stepFinishChunks[stepFinishChunks.length - 1];
          return lastStepFinish.result?.output || '';
        }

        // If no complete or step finish chunks, concatenate all agent chunks
        const agentChunks = storedChunks.filter(chunk => chunk.type === 'agentChunk');
        if (agentChunks.length > 0) {
          // Get the last agent's chunks
          const lastAgent = agentChunks[agentChunks.length - 1].agent;
          const lastAgentChunks = agentChunks.filter(chunk => chunk.agent === lastAgent);

          // Concatenate all chunks from the last agent
          return lastAgentChunks.map(chunk => chunk.chunk).join('');
        }

        return '';
      },
    } as NetworkStreamResult<Z>;
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
      writer: WritableStreamDefaultWriter<any>;
    },
  ): Promise<NetworkResult> {
    const { runId, resourceId, threadId, state, maxSteps, onStepStart, onStepFinish, writer } = options;

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
          writer.write({
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
        writer.write({
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
          // If input is a CoreMessage[] array, pass it directly
          if (Array.isArray(agentInput) && agentInput.length > 0 && 'role' in agentInput[0]) {
            // Use stream instead of generate to get real-time updates
            const streamResult = await nextAgent.stream(agentInput, {
              runId,
              resourceId,
              threadId,
            });

            // Forward the agent's stream chunks to our stream
            for await (const chunk of streamResult.textStream) {
              writer.write({
                type: 'agentChunk',
                agent: nextAgent.name,
                chunk,
                step: callCount,
              });
            }

            // Get the final result
            agentResult = await streamResult.text;
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
              writer.write({
                type: 'agentChunk',
                agent: nextAgent.name,
                chunk,
                step: callCount,
              });
            }

            // Get the final result
            agentResult = await streamResult.text;
          }
        } catch (error) {
          this.logger.error(`Error in agent execution during stream`, {
            networkName: this.name,
            agentName: nextAgent.name,
            runId,
            error,
          });

          // Write the error to the stream
          writer.write({
            type: 'error',
            agent: nextAgent.name,
            error: error.message || 'Unknown error in agent execution',
            step: callCount,
          });

          // Convert the error to a string result so we can continue
          agentResult = `Error: ${error.message || 'Unknown error in agent execution'}`;
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
        writer.write({
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
        writer.write({
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
