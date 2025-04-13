# Installing and Setting Up MCP

In this lesson, we'll learn how to enhance your Mastra agent with MCP (Model Context Protocol) servers. MCP allows your agent to access a wide range of external tools and services without having to write custom tool functions for each one.

## What is MCP?

MCP (Model Context Protocol) is a standard that allows AI models to access external tools and services through a consistent interface. By integrating MCP servers with your Mastra agent, you can give it access to:

- Email services like Gmail
- Code repositories like GitHub
- Social media platforms
- Weather information
- News sources
- File systems
- And many more services

## Installing MCP

First, let's install the Mastra MCP package:

```bash
npm install @mastra/mcp
```

## Setting Up MCP Configuration

Now, let's create a basic MCP configuration in your agent file. Open your `src/mastra/agents/index.ts` file and add the following imports:

```typescript
import { MCPConfiguration } from "@mastra/mcp";
```

Then, create a basic MCP configuration object:

```typescript
const mcp = new MCPConfiguration({
  servers: {
    // We'll add servers in the next steps
  },
});
```

## Initializing MCP Tools

Once you have the configuration set up, you need to initialize the MCP tools:

```typescript
const mcpTools = await mcp.getTools();
```

This asynchronous call fetches all the available tools from the configured MCP servers. We'll add these tools to our agent later.

## Updating Your Agent

Let's update your agent to use the MCP tools. Modify your agent definition to include the MCP tools:

```typescript
export const personalAssistantAgent = new Agent({
  name: "Personal Assistant",
  instructions: `
    You are a helpful personal assistant that can help with various tasks.
    
    Keep your responses concise and friendly.
  `,
  model: openai("gpt-4o"),
  tools: { ...mcpTools }, // Add MCP tools to your agent
});
```

## Testing Your Setup

At this point, your agent doesn't have any MCP servers configured yet, but the basic setup is in place. Let's test that everything is working:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. You should see your "Personal Assistant" agent in the list of agents
4. Try sending a message like "Hello, what can you help me with?"

The agent should respond, but it won't have any special capabilities yet. In the next steps, we'll add various MCP servers to give your agent powerful new abilities.

In the next step, we'll add the Zapier MCP server to give your agent access to email and social media tools.
