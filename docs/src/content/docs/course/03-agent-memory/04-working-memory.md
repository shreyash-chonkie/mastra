# Implementing Working Memory

In this step, we'll explore working memory, which allows your agent to maintain persistent information about users across interactions within a thread.

## What is Working Memory?

Working memory is like your agent's active thoughts or scratchpad – it's the key information they keep available about the user or task. It's similar to how a person would naturally remember someone's name, preferences, or important details during a conversation.

Unlike conversation history and semantic recall, which focus on remembering past messages, working memory is designed to store structured information that's continuously relevant, such as:

- User profile information (name, location, preferences)
- Task-specific details (project goals, deadlines)
- Session state (current topic, open questions)

## How Working Memory Works

Working memory is implemented as a block of Markdown text that the agent can update over time. The agent reads this information at the beginning of each conversation and can update it as new information becomes available.

## Configuring Working Memory

Let's update our agent with working memory capabilities:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance with working memory configuration
const memory = new Memory({
  options: {
    lastMessages: 20,
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
    },
    workingMemory: {
      enabled: true,
      use: "tool-call", // Recommended setting
    },
  },
});

// Create an agent with the configured memory
export const memoryAgent = new Agent({
  name: "MemoryAgent",
  instructions: `
    You are a helpful assistant with advanced memory capabilities.
    You can remember previous conversations and user preferences.
    
    IMPORTANT: You have access to working memory to store persistent information about the user.
    When you learn something important about the user, update your working memory.
    This includes:
    - Their name
    - Their location
    - Their preferences
    - Their interests
    - Any other relevant information that would help personalize the conversation
    
    Always refer to your working memory before asking for information the user has already provided.
    Use the information in your working memory to provide personalized responses.
  `,
  model: openai("gpt-4o"),
  memory: memory,
});
```

## Custom Working Memory Templates

Templates guide the agent on what information to track and update in working memory. While a default template is used if none is provided, you'll typically want to define a custom template tailored to your agent's specific use case.

Let's update our agent with a custom working memory template:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance with a custom working memory template
const memory = new Memory({
  options: {
    lastMessages: 20,
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
    },
    workingMemory: {
      enabled: true,
      use: "tool-call",
      template: `
# User Profile

## Personal Info

- Name:
- Location:
- Timezone:

## Preferences

- Communication Style: [e.g., Formal, Casual]
- Interests:
- Favorite Topics:

## Session State

- Current Topic:
- Open Questions:
  - [Question 1]
  - [Question 2]
`,
    },
  },
});

// Create an agent with the configured memory
export const memoryAgent = new Agent({
  name: "MemoryAgent",
  instructions: `
    You are a helpful assistant with advanced memory capabilities.
    You can remember previous conversations and user preferences.
    
    IMPORTANT: You have access to working memory to store persistent information about the user.
    When you learn something important about the user, update your working memory according to the template.
    
    Always refer to your working memory before asking for information the user has already provided.
    Use the information in your working memory to provide personalized responses.
    
    When the user shares personal information such as their name, location, or preferences,
    acknowledge it and update your working memory accordingly.
  `,
  model: openai("gpt-4o"),
  memory: memory,
});
```

## Testing Working Memory

Let's test our agent's working memory capabilities:

1. Update your agent code with the configuration above
2. Restart your development server with `npm run dev`
3. Open the playground at http://localhost:4111/
4. Select your "MemoryAgent"
5. Have a conversation that reveals personal information:
   - "Hi, my name is Jordan"
   - "I live in Toronto, Canada"
   - "I prefer casual communication"
   - "I'm interested in artificial intelligence and music production"
   - "What do you know about me so far?"

Your agent should be able to recall all this information from its working memory, even if the conversation has moved on to other topics.

6. Continue the conversation with new topics, then ask again:
   - "Let's talk about the latest AI developments"
   - (Have a conversation about AI)
   - "What was my name again and where do I live?"

The agent should still remember this information because it's stored in working memory, not just in the conversation history.

## Working Memory in Practice

Working memory is particularly useful for:

1. **Personal assistants** that need to remember user preferences
2. **Customer support agents** that need to track issue details
3. **Educational agents** that need to remember a student's progress
4. **Task-oriented agents** that need to track the state of a complex task

By using working memory effectively, you can create agents that feel more personalized and attentive to user needs.

In the next step, we'll bring everything together to create a complete memory-enhanced agent with all the features we've explored.
