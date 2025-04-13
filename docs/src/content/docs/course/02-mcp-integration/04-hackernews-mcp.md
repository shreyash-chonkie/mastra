# Adding the Hacker News MCP Server

In this step, we'll add the Hacker News MCP server to our agent, which will give it access to tech news and discussions from Hacker News.

## What is the Hacker News MCP Server?

The Hacker News MCP server provides tools for accessing content from Hacker News, including:
- Retrieving top stories
- Searching for specific stories
- Reading comments and discussions
- Staying updated on tech trends and news

## Setting Up the Hacker News MCP Server

Unlike the previous MCP servers that use URLs, the Hacker News MCP server can be run directly using NPX. This means we don't need to set up any external services or authentication.

### 1. Update Your MCP Configuration

Let's update your MCP configuration in `src/mastra/agents/index.ts` to include the Hacker News server:

```typescript
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
  },
});
```

This configuration tells MCP to run the Hacker News server using NPX when needed. The `-y` flag automatically confirms any prompts, making it seamless to use.

### 2. Update Your Agent's Instructions

Next, let's update your agent's instructions to include information about the Hacker News tools:

```typescript
export const personalAssistantAgent = new Agent({
  name: "Personal Assistant",
  instructions: `
    You are a helpful personal assistant that can help with various tasks such as email, 
    monitoring github activity, scheduling social media posts, and providing tech news.
    
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
    
    Keep your responses concise and friendly.
  `,
  model: openai("gpt-4o"),
  tools: { ...mcpTools },
  memory,
});
```

## Testing the Hacker News Integration

Let's test the Hacker News integration:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. Try asking your agent to perform Hacker News-related tasks, such as:
   - "What are the top stories on Hacker News today?"
   - "Find Hacker News discussions about AI agents"
   - "Summarize the comments on the top story"
   - "What's trending in tech on Hacker News?"

The first time you ask a Hacker News-related question, there might be a slight delay as the NPX command installs and starts the server. Subsequent queries should be faster.

### Troubleshooting

If your agent can't access the Hacker News tools, check:

1. That you have NPX installed and working properly
2. That your network allows NPX to download and run packages
3. That the tools are properly loaded by checking the Tools tab in the playground

In the next step, we'll add the Filesystem MCP server to give your agent the ability to read and write files locally.
