import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Agent } from '../agent';
import type { DynamicArgument, MastraLanguageModel } from '../agent';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import { RuntimeContext } from '../runtime-context';
import { createStep, createWorkflow } from '../workflows/vNext';

interface AgentNetworkConfig {
  name: string;
  agents: DynamicArgument<Record<string, Agent>>;
  model: DynamicArgument<MastraLanguageModel>;
  instructions: DynamicArgument<string>;
}

export class AgentNetwork extends MastraBase {
  #agents: DynamicArgument<Record<string, Agent>>;
  #model: DynamicArgument<MastraLanguageModel>;
  #instructions: DynamicArgument<string>;
  #name: string;

  constructor(config: AgentNetworkConfig) {
    super({ component: RegisteredLogger.NETWORK, name: 'AgentNetwork' });

    this.#name = config.name;
    this.#agents = config.agents;
    this.#model = config.model;
    this.#instructions = config.instructions;
  }

  async getRoutingAgent({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    const instructions = await this.getInstructions({ runtimeContext });
    const model = await this.getModel({ runtimeContext });
    const agents = await this.getAgents({ runtimeContext });
    return new Agent({
      name: this.#name,
      instructions: `
            You are a strategic routing agent in a multi-agent system. Your role is critical for orchestrating specialized agents to solve complex tasks efficiently.

            ROUTING RESPONSIBILITIES:
            1. Determine if the task is complete by comparing against original requirements
            2. Select the most appropriate specialized agent for the next step if the task is incomplete
            3. Create a clear, contextual prompt for the selected agent

            AVAILABLE AGENTS:
            ${Object.entries(agents)
              .map(
                ([agentId, agent]) => `
                Agent ID: ${agentId}
                Name: ${agent.name}
                Description: ${agent.description || 'No description provided'}`,
              )
              .join('\n\n')}

            ROUTING STRATEGY:
            - Logical progression: Move tasks through natural stages (research → creation → refinement)
            - Avoid agent repetition unless necessary for iterative improvement
            - Use repetition of information as a signal that a task may be complete
            - Enforce a maximum step limit (typically 5-7 steps) for efficiency
            - When in doubt about completion, err on the side of getting more feedback

            CONTEXT MANAGEMENT:
            - Maintain context across agent transitions
            - Include relevant information from previous steps
            - Highlight key insights and decisions made so far
            - Format information clearly for the next agent

            OUTPUT FORMAT:
            Your response must include:
            - agentId: The ID of the agent to handle the next step
            - prompt: A clear, detailed prompt for the selected agent
            - isComplete: Boolean indicating if the task is complete (true/false)
            - reasoning: Your explanation for this routing decision

            USER INSTRUCTIONS:
            ${instructions}

            Remember: Your effectiveness as a router directly impacts the quality of the final output. Make deliberate, strategic routing decisions.
            `,
      model: model,
    });
  }

  async getAgents({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    if (typeof this.#agents === 'function') {
      return await Promise.resolve(this.#agents({ runtimeContext: runtimeContext || new RuntimeContext() }));
    }
    return this.#agents;
  }

  async getModel({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    if (typeof this.#model === 'function') {
      return await Promise.resolve(this.#model({ runtimeContext: runtimeContext || new RuntimeContext() }));
    }
    return this.#model;
  }

  async getInstructions({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    if (typeof this.#instructions === 'function') {
      return await Promise.resolve(this.#instructions({ runtimeContext: runtimeContext || new RuntimeContext() }));
    }
    return this.#instructions;
  }

  getExecuteAgentWorkflow() {
    const networkInstance = this;

    // Create a step to execute the selected agent
    const executeAgentStep = createStep({
      id: 'execute-agent',
      description: 'Executes the selected agent with the provided prompt',
      inputSchema: z.object({
        task: z.string(),
        agentId: z.string(),
        prompt: z.string(),
        isComplete: z.boolean().default(false),
        reasoning: z.string(),
      }),
      outputSchema: z.object({
        task: z.string(),
        result: z.string(),
        agentId: z.string(),
        isComplete: z.boolean(),
      }),
      async execute({ inputData, runtimeContext }) {
        console.log(`Executing agent ${inputData.agentId}`);

        // If the task is complete, return the final result
        if (inputData.isComplete) {
          return {
            task: inputData.task,
            result: inputData.reasoning,
            agentId: inputData.agentId,
            isComplete: inputData.isComplete,
          };
        }

        const agents = await networkInstance.getAgents({ runtimeContext });

        // Find the selected agent by ID
        const selectedAgent = agents[inputData.agentId];

        if (!selectedAgent) {
          throw new Error(`Agent with ID ${inputData.agentId} not found`);
        }

        // Execute the selected agent
        const response = await selectedAgent.generate(inputData.prompt);

        console.log('Agent response:', response.text);

        return {
          task: inputData.task,
          result: response.text,
          agentId: inputData.agentId,
          isComplete: inputData.isComplete,
        };
      },
    });

    const executeAgentWorkflow = createWorkflow({
      id: `${this.#name}-execute-agent-workflow`,
      inputSchema: z.object({
        task: z.string(),
        agentId: z.string(),
        prompt: z.string(),
        isComplete: z.boolean().default(false),
        reasoning: z.string(),
      }),
      outputSchema: z.object({
        task: z.string(),
        result: z.string(),
        agentId: z.string(),
        isComplete: z.boolean(),
      }),
      steps: [executeAgentStep],
    });

    executeAgentWorkflow
      .then(executeAgentStep)
      .map({
        text: {
          path: 'result',
          step: executeAgentStep,
        },
        agentId: {
          path: 'agentId',
          step: executeAgentStep,
        },
        isComplete: {
          path: 'isComplete',
          step: executeAgentStep,
        },
        task: {
          path: 'task',
          step: executeAgentStep,
        },
      })
      .commit();

    return executeAgentWorkflow;
  }

  getRoutingAgentWorkflow() {
    const networkInstance = this;

    const routingAgentStep = createStep({
      id: 'routing-agent',
      description: 'Determines which agent to call based on the user message and context',
      inputSchema: z.object({
        task: z.string(),
        text: z.string().optional(),
        agentId: z.string().optional(),
        isComplete: z.boolean().optional(),
      }),
      outputSchema: z.object({
        agentId: z.string(),
        task: z.string(),
        prompt: z.string(),
        isComplete: z.boolean().default(false),
        reasoning: z.string(),
      }),
      async execute({ inputData, runtimeContext }) {
        console.log(`Routing step: ${inputData?.agentId ? 'Re-routing' : 'Initial routing'}`, inputData);

        // Get the routing agent from the network instance
        const routingAgent = await networkInstance.getRoutingAgent({ runtimeContext });

        // If we have previous agent output, we need to determine if the task is done
        if (inputData.agentId && inputData.text) {
          // Create a prompt that includes the previous agent's output
          const completionPrompt = `
                        You previously used agent ${inputData.agentId} which produced this output:
                        ${inputData.text}

                        Original request: ${inputData.task}

                        Is this task complete? Consider if all requirements from the original request have been met.

                        Return the fields
                        
                        isComplete: boolean
                        reasoning: string
                    `;

          // Generate a decision about task completion
          const completionResult = await routingAgent.generate(completionPrompt, {
            output: z.object({
              isComplete: z.boolean(),
              reasoning: z.string(),
            }),
          });

          // If the task is complete, return the final result
          if (completionResult.object.isComplete) {
            return {
              task: inputData.task,
              agentId: inputData.agentId,
              prompt: '',
              isComplete: true,
              reasoning: completionResult.object.reasoning,
            };
          }

          // If not complete, include the previous output in the prompt for the next agent
          const nextStepPrompt = `
                    Previous agent (${inputData.agentId}) output: ${inputData.text}

                    Original request: ${inputData.task}

                    The task is not yet complete. ${completionResult.object.reasoning}
                    
                    Determine which agent should handle the next step.
                    `;

          // Generate the routing decision for the next step
          const nextStepResult = await routingAgent.generate(nextStepPrompt, {
            output: z.object({
              agentId: z.string(),
              prompt: z.string(),
              isComplete: z.boolean().default(false),
              reasoning: z.string(),
            }),
          });

          console.log('nextStepResult', nextStepResult.object);

          return { ...nextStepResult.object, task: inputData.task };
        }

        // Generate the routing decision
        const result = await routingAgent.generate(inputData.task, {
          output: z.object({
            agentId: z.string(),
            prompt: z.string(),
            isComplete: z.boolean().default(false),
            reasoning: z.string(),
          }),
        });

        console.log('Routing to', JSON.stringify(result.object));

        return { ...result.object, task: inputData.task, isComplete: false };
      },
    });

    const routingAgentWorkflow = createWorkflow({
      id: `${this.#name}-routing-agent-workflow`,
      inputSchema: z.object({
        task: z.string(),
      }),
      outputSchema: z.object({
        text: z.string(),
        agentId: z.string(),
        isComplete: z.boolean().default(false),
      }),
    });

    const executeAgentStep = this.getExecuteAgentWorkflow();

    // Define the workflow execution flow
    routingAgentWorkflow
      .then(routingAgentStep)
      .branch([
        [
          async ({ inputData }) => {
            return !inputData?.isComplete;
          },
          executeAgentStep,
        ],
      ])
      .commit();

    return routingAgentWorkflow;
  }

  getNetworkWorkflow() {
    const controlWorkflow = createWorkflow({
      id: `${this.#name}-control-workflow`,
      inputSchema: z.object({
        task: z.string(),
      }),
      outputSchema: z.object({
        text: z.string(),
        agentId: z.string(),
        isComplete: z.boolean().default(false),
      }),
    });

    controlWorkflow
      .dountil(this.getRoutingAgentWorkflow(), async ({ inputData }) => {
        return inputData?.isComplete;
      })
      .commit();

    return controlWorkflow;
  }

  async generate(
    message: string,
    options?: {
      maxSteps?: number;
      runId?: string;
    },
  ) {
    const runId = options?.runId || randomUUID();
    const workflow = this.getNetworkWorkflow();

    // Initialize the workflow run
    const run = workflow.createRun({ runId });

    const result = await run.start({
      inputData: {
        task: message,
      },
    });

    return result;
  }
}
