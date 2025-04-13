# Implementing Semantic Recall

In this step, we'll explore semantic recall, a powerful memory feature that helps agents maintain context across longer interactions when messages are no longer within recent conversation history.

## What is Semantic Recall?

Semantic recall is a RAG-based (Retrieval-Augmented Generation) search that allows your agent to find and retrieve relevant past conversations based on the current user query. It's similar to how a person would search their memory for relevant information when asked a question.

For example, if a user asks "What did we discuss about my project last week?", semantic recall helps the agent find and retrieve those specific conversations, even if they happened many messages ago.

## How Semantic Recall Works

Semantic recall uses vector embeddings of messages for similarity search. When a user sends a message, the system:

1. Creates an embedding (vector representation) of the message
2. Searches for similar message embeddings in the history
3. Retrieves the most relevant messages
4. Includes those messages and their surrounding context in the agent's context window

This allows the agent to "remember" relevant information from past conversations, even if they're not in the recent message history.

## Configuring Semantic Recall

Semantic recall is enabled by default when you create a Memory instance. However, you can customize its behavior with the following parameters:

1. **topK**: How many semantically similar messages to retrieve
2. **messageRange**: How much surrounding context to include with each match

Let's update our agent with custom semantic recall settings:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance with semantic recall configuration
const memory = new Memory({
  options: {
    lastMessages: 20, // Include the last 20 messages in the context
    semanticRecall: {
      topK: 3, // Retrieve 3 most similar messages
      messageRange: {
        before: 2, // Include 2 messages before each match
        after: 1,  // Include 1 message after each match
      },
    },
  },
});

// Create an agent with the configured memory
export const memoryAgent = new Agent({
  name: "MemoryAgent",
  instructions: `
    You are a helpful assistant with advanced memory capabilities.
    You can remember previous conversations and user preferences.
    When a user shares information about themselves, acknowledge it and remember it for future reference.
    If asked about something mentioned earlier in the conversation, recall it accurately.
    You can also recall relevant information from older conversations when appropriate.
  `,
  model: openai("gpt-4o"),
  memory: memory,
});
```

## Vector Store Configuration

By default, semantic recall uses an in-memory vector store for development purposes. For production applications, you'll want to use a persistent vector store. Mastra supports several options:

```typescript
import { Memory } from "@mastra/memory";
import { ChromaVectorStore } from "@mastra/chroma";

const memory = new Memory({
  options: {
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
      // Configure a persistent vector store
      vectorStore: new ChromaVectorStore({
        collectionName: "memory",
        url: "http://localhost:8000",
      }),
    },
  },
});
```

Mastra supports several vector store options, including:
- In-memory (default for development)
- Chroma
- Pinecone
- Qdrant
- Postgres (with pgvector)

## Testing Semantic Recall

Let's test our agent's semantic recall capabilities:

1. Update your agent code with the configuration above
2. Restart your development server with `npm run dev`
3. Open the playground at http://localhost:4111/
4. Select your "MemoryAgent"
5. Have a conversation with multiple topics:
   - "Let's talk about my work project first"
   - "I'm working on a new website for a client"
   - "The deadline is in two weeks"
   - "Now let's switch topics. I'm also planning a vacation"
   - "I'll be visiting Japan next month"
   - "I'll be staying in Tokyo and Kyoto"
   - "Let's talk about something else. I'm learning to play guitar"
   - "I practice for 30 minutes every day"
   - "Can you remind me about my work project deadline?"

Your agent should be able to recall the project deadline information, even though it was mentioned several messages ago and the conversation has moved on to other topics.

## Disabling Semantic Recall

In some cases, you might want to disable semantic recall, for example, if you're building a simple chatbot that doesn't need to recall older conversations. You can do this by setting `enabled: false`:

```typescript
const memory = new Memory({
  options: {
    semanticRecall: {
      enabled: false, // Disable semantic recall
    },
  },
});
```

In the next step, we'll explore working memory, which allows your agent to maintain persistent information about users across interactions.
