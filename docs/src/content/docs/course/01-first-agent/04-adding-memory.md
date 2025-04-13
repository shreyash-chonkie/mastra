# Adding Memory to Your Agent

In this final step, we'll add memory to our agent so it can remember previous conversations with users. Memory is a crucial component for creating more natural and context-aware agents.

## Understanding Memory in Agents

Memory allows your agent to:

- Remember previous user questions and its own responses
- Maintain context across multiple interactions
- Provide more personalized and relevant responses
- Avoid asking for the same information repeatedly

## Installing Memory

First, we need to install the Mastra memory package:

```bash
npm install @mastra/memory
```

## Adding Memory to Your Agent

Now, let's update our agent to include memory. Open your `agents/index.ts` file and make the following changes:

1. Import the Memory class:

```typescript
import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { getTransactionsTool } from "../tools";
```

2. Add memory to your agent:

```typescript
export const financialAgent = new Agent({
  name: "Financial Assistant Agent",
  instructions: `ROLE DEFINITION
  // ... existing instructions ...
  `,
  model: openai("gpt-4o"),
  tools: { getTransactionsTool },
  memory: new Memory(), // Add memory here
});
```

## Testing Your Agent with Memory

Let's test our agent's memory capabilities in the playground:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. Start a conversation with your agent by asking about transactions
4. Then, ask a follow-up question that references the previous conversation, like:
   - "What was that largest transaction again?"
   - "Can you categorize those Amazon purchases we talked about?"
   - "How does my spending this month compare to what you showed me earlier?"

Your agent should now be able to remember previous conversations and provide more contextual responses.

## Congratulations!

You've successfully built your first Mastra agent with:

- A well-defined system prompt
- A custom tool for fetching transaction data
- Memory for maintaining context across conversations

This is just the beginning of what you can do with Mastra. Here are some ways you could extend your agent:

- Add more tools or use MCP to expand its capabilities (we will cover this in the next lesson)
- Implement more sophisticated memory storage
- Create a workflow that combines multiple agents
- Deploy your agent to a production environment

For more information and advanced features, check out the [Mastra documentation](https://mastra.ai/docs).
