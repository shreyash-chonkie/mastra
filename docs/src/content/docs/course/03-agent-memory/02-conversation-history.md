# Managing Conversation History

In this step, we'll learn how to configure conversation history and understand memory threads in Mastra. Conversation history allows your agent to remember recent interactions, which is essential for maintaining context in ongoing conversations.

## Understanding Memory Threads

Mastra organizes memory into threads, which are records that identify specific conversation histories. Each thread uses two important identifiers:

1. **`threadId`**: A specific conversation ID (e.g., `support_123`)
2. **`resourceId`**: The user or entity ID that owns each thread (e.g., `user_alice`)

These identifiers are crucial for memory to work properly outside of the playground.

## Configuring Conversation History

By default, the `Memory` instance includes the last 40 messages from the current memory thread in each new request. You can customize this by configuring the `lastMessages` option:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance with custom conversation history settings
const memory = new Memory({
  options: {
    lastMessages: 20, // Include the last 20 messages in the context
  },
});

// Create an agent with the configured memory
export const memoryAgent = new Agent({
  name: "MemoryAgent",
  instructions: `
    You are a helpful assistant with memory capabilities.
    You can remember previous conversations and user preferences.
    When a user shares information about themselves, acknowledge it and remember it for future reference.
    If asked about something mentioned earlier in the conversation, recall it accurately.
  `,
  model: openai("gpt-4o"),
  memory: memory,
});
```

## Using Memory in Your Application

When using memory in your own application (outside the playground), you need to provide the `resourceId` and `threadId` with each agent call:

```typescript
// Example of using memory in your application
const response = await memoryAgent.stream("Hello, my name is Alice.", {
  resourceId: "user_alice",
  threadId: "conversation_123",
});
```

**Important:** Without these IDs, your agent will not use memory, even if memory is properly configured. The playground handles this for you, but you need to add IDs yourself when using memory in your application.

## Storage Configuration

Conversation history relies on a storage adapter to persist messages. By default, Mastra uses a LibSQL store that saves messages to a local SQLite database. You can configure this or use other storage options:

```typescript
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/core/storage/libsql";

const memory = new Memory({
  // Configure storage
  storage: new LibSQLStore({
    config: {
      url: "file:memory.db", // Local SQLite database
    },
  }),
  options: {
    lastMessages: 20,
  },
});
```

Mastra supports several storage options, including:
- LibSQL (default, local SQLite)
- PostgreSQL
- Upstash (Redis)

## Testing Conversation History

Let's update our agent and test the conversation history capabilities:

1. Update your agent code with the configuration above
2. Restart your development server with `npm run dev`
3. Open the playground at http://localhost:4111/
4. Select your "MemoryAgent"
5. Try having a longer conversation with multiple turns:
   - "Let me tell you about my vacation plans"
   - "I'm planning to visit Japan next month"
   - "I'll be staying in Tokyo for a week"
   - "Then I'll visit Kyoto for three days"
   - "What were my vacation plans again?"

Your agent should be able to recall the details of your vacation plans because it maintains the conversation history.

## Handling Memory in Frontend Applications

When building a frontend application that uses Mastra memory, it's important to only send the newest user message in each agent call. Mastra handles retrieving and injecting the necessary history. Sending the full history yourself will cause duplication.

Here's a simplified example of how to handle this in a React application:

```tsx
import { useState } from 'react';
import { memoryAgent } from './agents';

function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  const handleSendMessage = async () => {
    // Add user message to UI
    setMessages([...messages, { role: 'user', content: input }]);
    
    // Only send the newest message to the agent
    const response = await memoryAgent.stream(input, {
      resourceId: "user_123",
      threadId: "conversation_456",
    });
    
    // Add agent response to UI
    setMessages([...messages, { role: 'assistant', content: response }]);
    setInput('');
  };
  
  return (
    <div>
      {/* Display messages */}
      <div>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      {/* Input for new messages */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
}
```

In the next step, we'll explore semantic recall, which allows your agent to remember information from older conversations that are no longer in the recent history.
