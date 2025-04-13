# Creating Your First Agent

In this step, we'll create a simple agent with a well-defined system prompt. The system prompt is crucial as it defines the agent's purpose, capabilities, and behavioral guidelines.

## Understanding System Prompts

A good system prompt should include:

- **Role definition**: What the agent is and what it does
- **Core capabilities**: What tasks the agent can perform
- **Behavioral guidelines**: How the agent should respond and interact
- **Constraints**: What the agent should not do or discuss
- **Success criteria**: What makes the agent's responses good

## Creating Your Agent

Let's create a simple agent that will help users analyze financial transaction data. We'll start by modifying the `agents/index.ts` file.

First, make sure you have the necessary imports at the top of your file:

```typescript
import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
// We'll import our tool in the next step
```

Now, let's create our agent:

```typescript
export const financialAgent = new Agent({
  name: "Financial Assistant Agent",
  instructions: `ROLE DEFINITION
- You are a financial assistant that helps users analyze their transaction data.
- Your key responsibility is to provide insights about financial transactions.
- Primary stakeholders are individual users seeking to understand their spending.

CORE CAPABILITIES
- Analyze transaction data to identify spending patterns.
- Answer questions about specific transactions or vendors.
- Provide basic summaries of spending by category or time period.

BEHAVIORAL GUIDELINES
- Maintain a professional and friendly communication style.
- Keep responses concise but informative.
- Always clarify if you need more information to answer a question.
- Format currency values appropriately.
- Ensure user privacy and data security.

CONSTRAINTS & BOUNDARIES
- Do not provide financial investment advice.
- Avoid discussing topics outside of the transaction data provided.
- Never make assumptions about the user's financial situation beyond what's in the data.

SUCCESS CRITERIA
- Deliver accurate and helpful analysis of transaction data.
- Achieve high user satisfaction through clear and helpful responses.
- Maintain user trust by ensuring data privacy and security.`,
  model: openai("gpt-4o"), // You can use "gpt-3.5-turbo" if you prefer
  tools: {}, // We'll add tools in the next step
});
```

## Exporting Your Agent

To make your agent available to the playground, you need to export it through the Mastra class in your `src/mastra/index.ts` file:

```typescript
import { Mastra } from "@mastra/core";
import { financialAgent } from "./agents";

export const mastra: Mastra = new Mastra({
  agents: {
    financialAgent,
  },
});
```

This creates a new Mastra instance that includes your financial agent, making it available to the playground and any other parts of your application.

## Testing Your Agent

Now let's test our agent in the playground:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. You should see your "Financial Assistant Agent" in the list of agents
4. Try sending a message like "Hello, can you help me analyze my spending?"

At this point, your agent can respond to basic questions but doesn't have access to any transaction data. In the next step, we'll create a custom tool to fetch transaction data from a Google Sheet.
