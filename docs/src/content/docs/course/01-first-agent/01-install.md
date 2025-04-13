# Getting Started with Mastra

Welcome to the first step of building your first Mastra agent! In this lesson, you'll learn how to create a simple agent that can read data from a public Google Sheet using a custom tool function.

## What is an Agent?

An agent is software with non-deterministic code that can make autonomous decisions based on inputs and environment rather than following fixed, predictable instructions every time.

Agents are AI systems that can:

- Perceive their environment through various inputs
- Make decisions based on those inputs
- Take actions to accomplish specific goals
- Learn and adapt their behavior over time

The best agents use several important features:

1. **Memory**: They remember past interactions and learn from them
2. **Planning**: They can break down complex tasks into smaller steps
3. **Tool use**: They can leverage external tools and APIs to expand their capabilities
4. **Feedback loops**: They can evaluate their own performance and adjust accordingly

## What is Mastra?

[Mastra](https://github.com/mastra-ai/mastra) is an open-source AI Agent Framework for TypeScript that includes all the basic primitives for AI engineering right out of the box:

- Agents with tools, memory, and tracing
- State-machine based workflows
- Evals for tracking and measuring AI output
- Storage for RAG pipelines
- Local development playground

## Verifying Your Mastra Installation

Before we begin building our agent, let's make sure you have Mastra properly installed. If you haven't installed Mastra yet, you can do so by running:

```bash
npm create mastra@latest
```

Follow the on-screen prompts and make sure to:

- Opt-in to installing both Agents and Workflows
- Say yes to installing tools
- Select OpenAI, Anthropic, or Google for your model
- Say yes to adding an example

You'll also need to add your OpenAI, Anthropic, or Google API key to the project.

### Verifying Project Structure

Let's check that your project has the correct structure. You should have:

1. A `src/mastra` directory that contains:
   - `index.ts` - The main entry point for your Mastra project
   - `agents/index.ts` - Where your agents are defined
   - `tools/index.ts` - Where your tools are defined

If these files exist, you're ready to start building your agent!

## Running the Playground

To test your agent as you build it, you'll need to run the Mastra playground:

```bash
npm run dev
```

This will start the playground at http://localhost:4111/, where you can interact with your agent and test its capabilities.

In the next step, we'll create our first agent with a simple system prompt and test it in the playground.
