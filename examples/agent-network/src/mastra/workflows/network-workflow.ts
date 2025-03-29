import { Agent } from '@mastra/core/agent';
import { createDataStream, DataStreamWriter } from 'ai';
import { Step, WhenConditionReturnValue, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { CoreMessage, LanguageModel } from '@mastra/core';

export class AgentNetwork {
  #agents: Record<string, Agent>;
  #routingAgent: Agent;
  maxSteps: number;
  constructor({
    agents,
    instructions,
    model,
    maxSteps = 5,
  }: {
    instructions: string;
    agents: Record<string, Agent>;
    model: LanguageModel;
    maxSteps?: number;
  }) {
    this.#agents = agents;
    this.maxSteps = maxSteps;

    const routingInstructions = `
            ## Your Role: Task Coordinator
            You are a task coordinator that manages a workflow of specialized agents. Your job is to:
            1. Determine if a task is complete based on work done so far
            2. If incomplete, select the most appropriate agent for the next step
            3. Create a clear prompt for the selected agent

            ## Available Agents
            ${Object.entries(this.#agents)
              .map(([agentKey, agent]) => {
                return ` - ${agent.name}: ${agent.description}`;
              })
              .join('\n')}

            ## Decision Making Process
            For each decision point, follow these steps in order:
            
            1. TASK COMPLETION CHECK:
               - Review all completed work
               - Compare against the original task requirements
               - Determine if ALL requirements have been satisfied
               - If yes, mark task as complete (overall_task_completed: true)
            
            2. AGENT SELECTION (only if task is incomplete):
               - Identify what specific work remains to be done
               - Match remaining work to agent capabilities
               - Select ONE agent best suited for the next step
            
            3. PROMPT CREATION (only if task is incomplete):
               - Create a clear, specific prompt for the selected agent
               - Include relevant context from previous steps
               - Focus the prompt on the specific subtask needed

            ## Task Progression Guidelines
            - A task should progress through logical stages (e.g., research → synthesis → refinement)
            - Avoid repeating the same agent unless it needs to build on its previous work
            - If you notice the same information being repeated, consider the task complete
            - Maximum ${this.maxSteps} steps allowed - prioritize efficiency

            ## User Instructions
            ${instructions}

            ## Output Format
            Return your response in this exact format:
            agent: [Exact name of the agent to handle the next step]
            prompt: [Specific instructions for the agent]
            overall_task_completed: [true only if ALL requirements are satisfied]
        `;

    this.#routingAgent = new Agent({
      name: 'Routing Agent',
      instructions: routingInstructions,
      model,
    });
  }

  getAgentWorkflow({ streamWriter }: { streamWriter?: DataStreamWriter } = {}) {
    const agentWorkflow = new Workflow({
      name: 'Agent Workflow',
      triggerSchema: z.object({
        agent: z.string(),
        prompt: z.string(),
      }),
    });

    Object.entries(this.#agents).forEach(([_, a]) => {
      const agentStep = new Step({
        id: `Agent Step: ${a.name}`,
        description: `Agent Step: ${a.name}`,
        outputSchema: z.object({
          content: z.string(),
        }),
        execute: async ({ context }) => {
          console.log('Executing Agent Step: ', a.name);
          const prompt = context.triggerData.prompt;

          let agentResponse;
          if (streamWriter) {
            const streamResult = await new Promise(async (resolve, reject) => {
              const streamResult = await a.stream(prompt, {
                onFinish: (result: any) => {
                  try {
                    return resolve(JSON.parse(result.text));
                  } catch (e) {
                    return resolve(result.text);
                  }
                },
                onError: (error: any) => {
                  return reject(error);
                },
              });

              streamResult.mergeIntoDataStream(streamWriter);
            });

            agentResponse = streamResult;
          } else {
            const agentResponseResult = await a.generate(prompt);
            agentResponse = agentResponseResult.text;
          }

          return { content: agentResponse };
        },
      });

      agentWorkflow.step(agentStep, {
        when: async ({ context }) => {
          return context.triggerData.agent === a.name
            ? WhenConditionReturnValue.CONTINUE
            : WhenConditionReturnValue.CONTINUE_FAILED;
        },
      });
    });

    agentWorkflow.commit();

    return agentWorkflow;
  }

  getWorkflow({ streamWriter }: { streamWriter?: DataStreamWriter } = {}) {
    const workflow = new Workflow({
      name: 'Routing Workflow',
      triggerSchema: z.object({
        prompt: z.string(),
      }),
    });

    const agentWorkflow = this.getAgentWorkflow({
      streamWriter,
    });

    let stepCount = 0;

    const routingStep = new Step({
      id: 'Routing Step',
      description: 'Routing Step',
      outputSchema: z.object({
        agent: z.string(),
        overall_task_completed: z.boolean(),
        prompt: z.string(),
      }),
      execute: async ({ context }) => {
        console.log('Step count', stepCount);
        if (stepCount > this.maxSteps) {
          return {
            overall_task_completed: true,
            agent: '',
            prompt: '',
          };
        }

        console.log('Executing Routing Step', context.triggerData);
        const prompt = context.triggerData.prompt;

        const results = context.getStepResult<any>(mergeResultsStep);

        const completedSteps = Object.entries(results || {})
          .filter(([step, result]: [string, any]) => {
            return result.status === 'success';
          })
          .map(([step, result]: [string, any]) => {
            return {
              role: 'assistant',
              content: `${step}: ${result.output.content}`,
            };
          }) as CoreMessage[];

        console.log('Completed Steps:', completedSteps?.length);

        // Check for task completion

        const taskCompletionPrompt = `
                <task>
                    <description>${prompt}</description>
                    <progress>
                        Current step count: ${stepCount} of maximum ${this.maxSteps} steps
                    </progress>
                    <goal>
                      Is the task completed?
                    </goal>
                    <output>
                        <item>
                            <key>overall_task_completed</key>
                            <description>True only if the task is fully complete</description>
                        </item>
                        <item>
                            <key>reason</key>
                            <description>Reason for the task completion</description>
                        </item>
                    </output>
                </task>
                `;

        const messages = [
          ...completedSteps,
          {
            role: 'user',
            content: taskCompletionPrompt,
          },
        ] as CoreMessage[];

        let taskCompletionResult;

        if (streamWriter) {
          taskCompletionResult = await new Promise(async (resolve, reject) => {
            const streamResult = await this.#routingAgent.stream(messages, {
              experimental_output: z.object({
                overall_task_completed: z.boolean(),
                reason: z.string(),
              }),
              onFinish: (result: any) => {
                return resolve(JSON.parse(result.text));
              },
              onError: (error: any) => {
                return reject(error);
              },
            });

            streamResult.mergeIntoDataStream(streamWriter);
          });
        } else {
          taskCompletionResult = (
            await this.#routingAgent.generate(messages, {
              output: z.object({
                overall_task_completed: z.boolean(),
                reason: z.string(),
              }),
            })
          )?.object;
        }

        if (taskCompletionResult?.overall_task_completed) {
          return {
            overall_task_completed: true,
            agent: '',
            prompt: '',
          };
        }

        const routingPrompt = `
                <task>
                    <description>Original task: "${prompt}"</description>
                </task>

                <decision_required>
                    1. Is this task FULLY complete based on the completed steps?
                    2. If not complete, which agent should handle the next step?
                    3. What specific instructions should that agent receive?
                </decision_required>

                <output_format>
                    agent: [Exact name of the agent to handle the next step]
                    prompt: [Specific instructions for the agent]
                    overall_task_completed: [true only if the task is fully complete]
                </output_format>
                `;

        const routingMessages = [
          ...completedSteps,
          {
            role: 'user',
            content: routingPrompt,
          },
        ] as CoreMessage[];

        let routingResponse;

        if (streamWriter) {
          routingResponse = await new Promise(async (resolve, reject) => {
            const streamResult = await this.#routingAgent.stream(routingMessages, {
              experimental_output: z.object({
                agent: z.string(),
                prompt: z.string(),
                overall_task_completed: z.boolean(),
              }),
              onFinish: (result: any) => {
                return resolve(JSON.parse(result.text));
              },
              onError: (error: any) => {
                return reject(error);
              },
            });

            streamResult.mergeIntoDataStream(streamWriter);
          });
        } else {
          routingResponse = (
            await this.#routingAgent.generate(routingMessages, {
              output: z.object({
                agent: z.string(),
                prompt: z.string(),
                overall_task_completed: z.boolean(),
              }),
            })
          )?.object;
        }

        stepCount++;
        return routingResponse;
      },
    });

    const mergeResultsStep = new Step({
      id: 'Merge Results',
      description: 'Merge Results',
      execute: async ({ context }) => {
        const currentResults = context.getStepResult(mergeResultsStep);
        const result = context.getStepResult(agentWorkflow.name);

        console.log('Merging new results:', result);

        return {
          ...currentResults,
          ...result.results,
        };
      },
    });

    workflow
      .step(routingStep)
      .after(routingStep)
      .step(agentWorkflow, {
        variables: {
          agent: {
            step: routingStep,
            path: 'agent',
          },
          prompt: {
            step: routingStep,
            path: 'prompt',
          },
        },
      })
      .then(mergeResultsStep)
      .after(mergeResultsStep)
      .step(routingStep, {
        when: {
          ref: { step: routingStep, path: 'overall_task_completed' },
          query: { $eq: false },
        },
      })
      .commit();

    return workflow;
  }

  async generate(prompt: string) {
    const { runId, start } = this.getWorkflow().createRun();

    const res = await start({
      triggerData: {
        prompt,
      },
    });

    return { runId, results: res.results };
  }

  async stream(prompt: string) {
    const self = this;
    const stream = createDataStream({
      async execute(dataStream) {
        const { runId, start } = self
          .getWorkflow({
            streamWriter: dataStream,
          })
          .createRun();

        // Write data
        dataStream.writeData({ type: 'system', value: 'Starting workflow generation' });
        dataStream.writeData({ value: runId, type: 'runId' });

        // Write annotation
        dataStream.writeMessageAnnotation({ type: 'status', value: 'processing' });

        await start({
          triggerData: {
            prompt,
          },
        });
      },
      onError: error => `${error}`,
    });

    return stream;
  }
}
