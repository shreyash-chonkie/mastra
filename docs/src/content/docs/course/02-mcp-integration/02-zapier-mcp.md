# Adding the Zapier MCP Server

In this step, we'll add the Zapier MCP server to our agent, which will give it access to email, social media, and many other integrations available through Zapier.

## What is Zapier MCP?

Zapier MCP is a server that provides access to thousands of apps and services through the Zapier platform. This includes:

- Email services (Gmail, Outlook, etc.)
- Social media platforms (Twitter/X, LinkedIn, etc.)
- Project management tools (Trello, Asana, etc.)
- And many more

## Setting Up Zapier MCP

### 1. Get a Zapier MCP URL

First, you'll need to get a Zapier MCP URL. This typically requires:

1. Creating a Zapier account if you don't have one
2. Setting up the Zapier MCP integration
3. Getting your unique MCP URL

For this example, we'll use an environment variable to store the URL:

```bash
# Add this to your .env file
ZAPIER_MCP_URL=https://your-zapier-mcp-url.zapier.app
```

### 2. Update Your MCP Configuration

Now, let's update your MCP configuration in `src/mastra/agents/index.ts` to include the Zapier server:

```typescript
const mcp = new MCPConfiguration({
  servers: {
    zapier: {
      url: new URL(process.env.ZAPIER_MCP_URL || ""),
    },
  },
});
```

This configuration tells your agent how to connect to the Zapier MCP server.

### 3. Update Your Agent's Instructions

Next, let's update your agent's instructions to include information about the Zapier tools:

```typescript
export const personalAssistantAgent = new Agent({
  name: "Personal Assistant",
  instructions: `
    You are a helpful personal assistant that can help with various tasks such as email 
    and scheduling social media posts.
    
    You have access to the following tools:
    
    1. Gmail:
       - Use these tools for reading and categorizing emails from Gmail
       - You can categorize emails by priority, identify action items, and summarize content
       - You can also use this tool to send emails
    
    2. Typefully:
       - Use these tools for creating and managing tweet drafts with Typefully
       - It focuses on AI, Javascript, Typescript, and Science topics
    
    Keep your responses concise and friendly.
  `,
  model: openai("gpt-4o"),
  tools: { ...mcpTools },
  memory,
});
```

## Testing the Zapier Integration

Let's test the Zapier integration:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. Try asking your agent to perform tasks that use Zapier, such as:
   - "Check my recent emails"
   - "Draft a tweet about the latest JavaScript features"
   - "Summarize my unread emails"

If everything is set up correctly, your agent should be able to use the Zapier tools to perform these tasks.

### Troubleshooting

If your agent can't access the Zapier tools, check:

1. That your Zapier MCP URL is correct in your environment variables
2. That you've properly set up the Zapier MCP integration
3. That the tools are properly loaded by checking the Tools tab in the playground

In the next step, we'll add the GitHub MCP server to give your agent the ability to monitor and interact with GitHub repositories.
