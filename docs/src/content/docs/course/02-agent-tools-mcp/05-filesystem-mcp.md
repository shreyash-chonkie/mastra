# Adding the Filesystem MCP Server

In this final step, we'll add the Filesystem MCP server to our agent, which will give it the ability to read and write files on your local system. This is particularly useful for creating and managing notes, to-do lists, and other persistent data.

## What is the Filesystem MCP Server?

The Filesystem MCP server provides tools for interacting with your local file system, including:
- Reading files
- Writing to files
- Creating directories
- Listing files and directories
- Managing persistent data like notes and to-do lists

## Setting Up the Filesystem MCP Server

Like the Hacker News MCP server, the Filesystem MCP server can be run directly using a package manager. We'll use PNPX (the Pnpm version of NPX) to run it.

### 1. Create a Notes Directory

First, let's create a directory where our agent can store notes and other files:

```bash
mkdir -p notes
```

### 2. Update Your MCP Configuration

Now, let's update your MCP configuration in `src/mastra/agents/index.ts` to include the Filesystem server:

```typescript
import path from "path";

const mcp = new MCPConfiguration({
  servers: {
    zapier: {
      url: new URL(process.env.ZAPIER_MCP_URL || ""),
    },
    github: {
      url: new URL(process.env.COMPOSIO_MCP_GITHUB || ""),
    },
    hackernews: {
      command: "npx",
      args: ["-y", "@devabdultech/hn-mcp-server"],
    },
    textEditor: {
      command: "pnpx",
      args: [
        `@modelcontextprotocol/server-filesystem`,
        path.join(process.cwd(), "notes"),
      ],
    },
  },
});
```

This configuration tells MCP to run the Filesystem server using PNPX, pointing it to the "notes" directory we created. The `path.join(process.cwd(), "notes")` ensures that the path is correct regardless of where the application is run from.

### 3. Update Your Agent's Instructions

Next, let's update your agent's instructions to include information about the Filesystem tools:

```typescript
export const personalAssistantAgent = new Agent({
  name: "Personal Assistant",
  instructions: `
    You are a helpful personal assistant that can help with various tasks such as email, 
    monitoring github activity, scheduling social media posts, providing tech news,
    and managing notes and to-do lists.
    
    You have access to the following tools:
    
    1. Gmail:
       - Use these tools for reading and categorizing emails from Gmail
       - You can categorize emails by priority, identify action items, and summarize content
       - You can also use this tool to send emails
    
    2. GitHub:
       - Use these tools for monitoring and summarizing GitHub activity
       - You can summarize recent commits, pull requests, issues, and development patterns
    
    3. Typefully:
       - Use these tools for creating and managing tweet drafts with Typefully
       - It focuses on AI, Javascript, Typescript, and Science topics
    
    4. Hackernews:
       - Use this tool to search for stories on Hackernews
       - You can use it to get the top stories or specific stories
       - You can use it to retrieve comments for stories
    
    5. Filesystem:
       - You also have filesystem read/write access to a notes directory. 
       - You can use that to store info for later use or organize info for the user.
       - You can use this notes directory to keep track of to-do list items for the user.
       - Notes dir: ${path.join(process.cwd(), "notes")}
    
    Keep your responses concise and friendly.
  `,
  model: openai("gpt-4o"),
  tools: { ...mcpTools },
  memory,
});
```

## Testing the Filesystem Integration

Let's test the Filesystem integration:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. Try asking your agent to perform Filesystem-related tasks, such as:
   - "Create a to-do list for me"
   - "Add 'Buy groceries' to my to-do list"
   - "Create a note about the meeting tomorrow"
   - "What's on my to-do list?"
   - "Read my meeting notes"

The first time you ask a Filesystem-related question, there might be a slight delay as the PNPX command installs and starts the server. Subsequent queries should be faster.

### Troubleshooting

If your agent can't access the Filesystem tools, check:

1. That you have PNPX installed and working properly
2. That the "notes" directory exists in the correct location
3. That the tools are properly loaded by checking the Tools tab in the playground

## Bringing It All Together

Now that we've added all the MCP servers, let's make a few final adjustments to our agent to ensure everything works smoothly together.

### 1. Add the Weather Tool

In the original code, we also included a weather tool. Let's add that to our agent:

```typescript
import { weatherTool } from "../tools";

export const personalAssistantAgent = new Agent({
  name: "Personal Assistant",
  instructions: `
    // ... existing instructions ...
    
    4. Weather:
       - Use this tool for getting weather information for specific locations
       - It can provide details like temperature, humidity, wind conditions, and weather conditions
       - Always ask for the location or if it's not provided try to use your working memory 
         to get the user's last requested location
    
    // ... rest of the instructions ...
  `,
  model: openai("gpt-4o"),
  tools: { ...mcpTools, weatherTool },
  memory,
});
```

### 2. Enhance Memory Configuration

Finally, let's enhance our memory configuration to make our agent even more helpful:

```typescript
const memory = new Memory({
  options: {
    // Keep last 20 messages in context
    lastMessages: 20,
    // Enable semantic search to find relevant past conversations
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
    },
    // Enable working memory to remember user information
    workingMemory: {
      enabled: true,
      template: `<user>
         <first_name></first_name>
         <username></username>
         <preferences></preferences>
         <interests></interests>
         <conversation_style></conversation_style>
       </user>`,
      use: "tool-call",
    },
  },
});
```

And update the agent instructions to use this enhanced memory:

```typescript
export const personalAssistantAgent = new Agent({
  name: "Personal Assistant",
  instructions: `
    // ... existing instructions ...
    
    You have access to conversation memory and can remember details about users.
    When you learn something about a user, update their working memory using the appropriate tool.
    This includes:
    - Their interests
    - Their preferences
    - Their conversation style (formal, casual, etc.)
    - Any other relevant information that would help personalize the conversation

    Always maintain a helpful and professional tone.
    Use the stored information to provide more personalized responses.
  `,
  model: openai("gpt-4o"),
  tools: { ...mcpTools, weatherTool },
  memory,
});
```

## Conclusion

Congratulations! You've successfully enhanced your Mastra agent with MCP servers, giving it powerful capabilities including:

1. Email and social media integration through Zapier
2. GitHub monitoring through the Composio GitHub MCP server
3. Tech news access through the Hacker News MCP server
4. Local file management through the Filesystem MCP server
5. Enhanced memory for personalized interactions

Your agent is now a versatile personal assistant that can help with a wide range of tasks. Feel free to experiment with different MCP servers and configurations to further enhance your agent's capabilities.

For more information on MCP and available servers, check out the [Mastra MCP documentation](https://mastra.ai/docs/reference/tools/).
