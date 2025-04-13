# Understanding Memory in Mastra

In this lesson, we'll explore how to enhance your Mastra agents with memory capabilities. Memory is a crucial component that allows agents to maintain context across conversations, remember user preferences, and provide more personalized responses.

## What is Agent Memory?

Memory in Mastra is how agents manage the context that's available to them during conversations. It's essentially a condensation of chat messages and relevant information into the agent's context window.

The context window is divided into three main parts:
1. **System instructions and user information** (working memory)
2. **Recent messages** (conversation history)
3. **Older relevant messages** (semantic recall)

## Why Memory Matters

Without memory, agents respond to each message in isolation, which can lead to repetitive questions and an inability to maintain context. With memory, your agents can:

- Remember previous user inputs and their own responses
- Recall user preferences and personal details
- Reference past conversations when relevant
- Provide more personalized and contextual responses
- Maintain state across multiple interactions

## Installing Memory

Let's start by installing the Mastra memory package:

```bash
npm install @mastra/memory
```

## Creating a Basic Memory Agent

Now, let's create a simple agent with memory capabilities. We'll start with the basics and add more advanced features in the following steps.

Create or update your `src/mastra/agents/index.ts` file:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a basic memory instance
const memory = new Memory();

// Create an agent with memory
export const memoryAgent = new Agent({
  name: "MemoryAgent",
  instructions: `
    You are a helpful assistant with memory capabilities.
    You can remember previous conversations and user preferences.
    When a user shares information about themselves, acknowledge it and remember it for future reference.
    If asked about something mentioned earlier in the conversation, recall it accurately.
  `,
  model: openai("gpt-4o"), // You can use "gpt-3.5-turbo" if you prefer
  memory: memory,
});
```

## Updating Your Mastra Export

Make sure to update your `src/mastra/index.ts` file to include your new memory agent:

```typescript
import { Mastra } from "@mastra/core";
import { memoryAgent } from "./agents";

export const mastra: Mastra = new Mastra({
  agents: {
    memoryAgent,
  },
});
```

## Testing Your Memory Agent

Let's test our basic memory agent:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. Select your "MemoryAgent" from the list of agents
4. Try having a conversation that tests basic memory capabilities:
   - "My name is Alex"
   - "What's my name?"
   - "I live in Seattle"
   - "Where do I live?"
   - "I prefer dark mode in my apps"
   - "What are my UI preferences?"

You should notice that your agent can remember information across these interactions. This is because the Mastra playground automatically handles the necessary resource and thread IDs for memory to work properly.

In the next step, we'll explore how to configure conversation history and understand how memory threads work.
