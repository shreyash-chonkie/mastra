# Building a Complete Memory-Enhanced Agent

In this final step, we'll bring together all the memory features we've explored to create a complete memory-enhanced agent. We'll also create a practical example that demonstrates how these features work together.

## Combining All Memory Features

Let's create a comprehensive agent that utilizes conversation history, semantic recall, and working memory:

```typescript
// src/mastra/agents/memory-agent.ts
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a comprehensive memory configuration
const memory = new Memory({
  options: {
    // Conversation history configuration
    lastMessages: 20, // Include the last 20 messages in the context
    
    // Semantic recall configuration
    semanticRecall: {
      topK: 3, // Retrieve 3 most similar messages
      messageRange: {
        before: 2, // Include 2 messages before each match
        after: 1,  // Include 1 message after each match
      },
    },
    
    // Working memory configuration
    workingMemory: {
      enabled: true,
      use: "tool-call",
      template: `
# User Profile

## Personal Info
- Name:
- Location:
- Timezone:
- Occupation:

## Preferences
- Communication Style:
- Topics of Interest:
- Learning Goals:

## Project Information
- Current Projects:
  - [Project 1]:
    - Deadline:
    - Status:
  - [Project 2]:
    - Deadline:
    - Status:

## Session State
- Current Topic:
- Open Questions:
- Action Items:
`,
    },
  },
});

// Create a comprehensive memory-enhanced agent
export const memoryMasterAgent = new Agent({
  name: "MemoryMasterAgent",
  instructions: `
    You are an advanced personal assistant with comprehensive memory capabilities.
    
    ## Memory Capabilities
    
    1. CONVERSATION HISTORY:
       - You can recall recent messages from the current conversation
       - Use this to maintain context in ongoing discussions
    
    2. SEMANTIC RECALL:
       - You can recall relevant information from older conversations
       - Use this when the user references something discussed earlier
    
    3. WORKING MEMORY:
       - You maintain persistent information about the user in your working memory
       - Always update this when you learn new information about the user
       - Reference this before asking for information the user has already provided
    
    ## Guidelines for Using Memory
    
    - When the user shares personal information (name, location, preferences, etc.),
      acknowledge it and update your working memory.
    
    - When the user asks about something mentioned earlier, use your conversation
      history and semantic recall to provide accurate information.
    
    - When helping with projects or tasks, track relevant details in working memory
      to provide consistent assistance across sessions.
    
    - Use the information in your memory to personalize your responses and
      demonstrate continuity in your understanding of the user's needs.
    
    - If you're unsure if you've stored certain information, check your working
      memory before asking the user to repeat themselves.
    
    Always maintain a helpful, friendly, and professional tone.
  `,
  model: openai("gpt-4o"),
  memory: memory,
});
```

## Updating Your Mastra Export

Make sure to update your `src/mastra/index.ts` file to include your new comprehensive memory agent:

```typescript
import { Mastra } from "@mastra/core";
import { memoryMasterAgent } from "./agents/memory-agent";

export const mastra: Mastra = new Mastra({
  agents: {
    memoryMasterAgent,
  },
});
```

## Creating a Practical Example: Personal Learning Assistant

Let's create a practical example of a memory-enhanced agent: a Personal Learning Assistant that helps users learn new skills and tracks their progress.

```typescript
// src/mastra/agents/learning-assistant.ts
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a specialized memory configuration for the learning assistant
const learningMemory = new Memory({
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
# Learner Profile

## Personal Info
- Name:
- Learning Style: [Visual, Auditory, Reading/Writing, Kinesthetic]

## Learning Journey
- Current Topics:
  - [Topic 1]:
    - Skill Level: [Beginner, Intermediate, Advanced]
    - Started: [Date]
    - Goals:
    - Resources:
    - Progress Notes:
  - [Topic 2]:
    - Skill Level: [Beginner, Intermediate, Advanced]
    - Started: [Date]
    - Goals:
    - Resources:
    - Progress Notes:

## Session State
- Current Focus:
- Questions to Revisit:
- Recommended Next Steps:
`,
    },
  },
});

// Create the learning assistant agent
export const learningAssistantAgent = new Agent({
  name: "Learning Assistant",
  instructions: `
    You are a personal learning assistant that helps users learn new skills and tracks their progress.
    
    ## Your Capabilities
    
    - You help users set learning goals and track their progress
    - You provide resources and explanations tailored to their learning style
    - You remember what topics they're studying and their skill level
    - You can recall previous explanations and build upon them
    
    ## Memory Usage Guidelines
    
    1. WORKING MEMORY:
       - Maintain the user's learning profile in working memory
       - Track their current topics, skill levels, and progress
       - Update this whenever you learn new information about their learning journey
    
    2. CONVERSATION HISTORY:
       - Use recent conversation history to maintain context in explanations
       - Reference previous examples when building on concepts
    
    3. SEMANTIC RECALL:
       - Recall relevant explanations from previous sessions when appropriate
       - Use this to provide consistent guidance across learning sessions
    
    When the user asks a question about a topic they're learning, check your
    working memory to understand their current skill level and provide an
    explanation at the appropriate depth.
    
    Always be encouraging and supportive. Focus on building the user's confidence
    and celebrating their progress.
  `,
  model: openai("gpt-4o"),
  memory: learningMemory,
});

// Don't forget to export this agent in your src/mastra/index.ts file
```

## Testing Your Memory-Enhanced Agents

Let's test both of our memory-enhanced agents:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/

### Testing the Memory Master Agent

1. Select your "MemoryMasterAgent"
2. Have a comprehensive conversation that tests all memory features:
   - Share personal information: "Hi, I'm Taylor. I live in Boston and work as a software engineer."
   - Discuss a project: "I'm working on a web application with a deadline next month."
   - Switch topics: "Let's talk about my vacation plans for the summer."
   - Return to the previous topic: "Remind me, what was the deadline for my web application?"
   - Ask about personal information: "What do you know about me so far?"

### Testing the Learning Assistant

1. Select your "Learning Assistant"
2. Have a conversation about learning programming:
   - "I want to learn Python programming. I'm a complete beginner."
   - "My learning style is visual - I learn best with diagrams and examples."
   - "Can you explain variables and data types in Python?"
   - "Now I'd like to learn about functions."
   - "Let's switch topics. I'm also interested in learning web development."
   - "I have some experience with HTML and CSS already."
   - "Can you go back to Python? I forgot how functions work."

Your agents should demonstrate all the memory capabilities we've explored:
- Remembering recent conversation context
- Recalling relevant information from older messages
- Maintaining persistent user information in working memory
- Using this information to provide personalized and contextual responses

## Memory Best Practices

As you build memory-enhanced agents, keep these best practices in mind:

1. **Be selective about what goes into working memory**
   - Focus on information that will be relevant across multiple conversations
   - Don't overload working memory with transient details

2. **Use clear instructions**
   - Give your agent explicit guidance on when and how to update working memory
   - Instruct it to check memory before asking for information the user has already provided

3. **Choose appropriate memory parameters**
   - Adjust `lastMessages`, `topK`, and `messageRange` based on your use case
   - More isn't always better - larger context windows can dilute focus

4. **Consider privacy implications**
   - Be transparent with users about what information is being stored
   - Implement appropriate security measures for sensitive information

5. **Test thoroughly**
   - Verify that your agent correctly recalls information across different scenarios
   - Test edge cases like conflicting information or corrections

## Conclusion

Congratulations! You've learned how to create sophisticated memory-enhanced agents using Mastra. You now understand:

- How to configure conversation history to maintain recent context
- How to implement semantic recall to find relevant past conversations
- How to use working memory to maintain persistent user information
- How to combine these features into comprehensive memory-enhanced agents

With these skills, you can create agents that provide truly personalized and contextual experiences for your users. Memory is what transforms a simple chatbot into an intelligent assistant that feels like it truly understands and remembers its users.

Continue experimenting with different memory configurations and templates to find what works best for your specific use cases. The more tailored your memory approach is to your agent's purpose, the more effective it will be.
