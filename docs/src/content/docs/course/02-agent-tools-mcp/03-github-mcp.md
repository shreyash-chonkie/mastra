# Adding the GitHub MCP Server

In this step, we'll add the Composio GitHub MCP server to our agent, which will give it the ability to monitor and interact with GitHub repositories.

## What is the GitHub MCP Server?

The GitHub MCP server provides tools for interacting with GitHub repositories, including:
- Monitoring repository activity
- Checking pull requests and issues
- Viewing commit history
- Summarizing development patterns

## Setting Up the GitHub MCP Server

### 1. Get a Composio GitHub MCP URL

First, you'll need to get a Composio GitHub MCP URL. This typically requires:

1. Setting up the Composio GitHub integration
2. Authenticating with your GitHub account
3. Getting your unique MCP URL

For this example, we'll use an environment variable to store the URL:

```bash
# Add this to your .env file
COMPOSIO_MCP_GITHUB=https://your-composio-github-mcp-url.com
```

### 2. Update Your MCP Configuration

Now, let's update your MCP configuration in `src/mastra/agents/index.ts` to include the GitHub server:

```typescript
const mcp = new MCPConfiguration({
  servers: {
    zapier: {
      url: new URL(process.env.ZAPIER_MCP_URL || ""),
    },
    github: {
      url: new URL(process.env.COMPOSIO_MCP_GITHUB || ""),
    },
  },
});
```

This configuration adds the GitHub MCP server alongside the Zapier server we added in the previous step.

### 3. Update Your Agent's Instructions

Next, let's update your agent's instructions to include information about the GitHub tools:

```typescript
export const personalAssistantAgent = new Agent({
  name: "Personal Assistant",
  instructions: `
    You are a helpful personal assistant that can help with various tasks such as email, 
    monitoring github activity, and scheduling social media posts.
    
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
    
    Keep your responses concise and friendly.
  `,
  model: openai("gpt-4o"),
  tools: { ...mcpTools },
  memory,
});
```

## Testing the GitHub Integration

Let's test the GitHub integration:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. Try asking your agent to perform GitHub-related tasks, such as:
   - "Check the recent activity on my repository"
   - "Summarize the open pull requests"
   - "What are the latest commits on the main branch?"
   - "Are there any issues that need my attention?"

If everything is set up correctly, your agent should be able to use the GitHub tools to provide this information.

### Troubleshooting

If your agent can't access the GitHub tools, check:

1. That your GitHub MCP URL is correct in your environment variables
2. That you've properly authenticated with GitHub
3. That the tools are properly loaded by checking the Tools tab in the playground

In the next step, we'll add the Hacker News MCP server to give your agent access to tech news and discussions.
