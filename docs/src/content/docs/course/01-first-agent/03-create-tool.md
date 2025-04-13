# Creating a Custom Tool

In this step, we'll create a custom tool that allows our agent to fetch transaction data from a public Google Sheet. Tools are a powerful way to extend your agent's capabilities by giving it access to external data sources and APIs.

## Understanding Tools in Mastra

Tools in Mastra are functions that your agent can call to perform specific tasks. Each tool has:

- A unique ID
- A clear description of what it does
- Input and output schemas that define the expected parameters and return values
- An execute function that performs the actual work

## Creating the getTransactions Tool

Let's create a tool that fetches transaction data from a Google Sheet. We'll add this to your `tools/index.ts` file.

First, make sure you have the necessary imports:

```typescript
import { createTool } from "@mastra/core";
import { z } from "zod";
```

Now, let's create our tool:

```typescript
export const getTransactionsTool = createTool({
  id: "get-transactions",
  description: "Get transaction data from Google Sheets",
  inputSchema: z.object({}), // No input parameters needed
  outputSchema: z.object({
    csvData: z.string(),
  }),
  execute: async () => {
    return await getTransactions();
  },
});

const getTransactions = async () => {
  // This URL points to a public Google Sheet with transaction data
  const url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQWaCzJAFsF4owWRHQRLo4G0-ERv31c74OOZFnqLiTLaP7NweoiX7IXvzQud2H6bdUPnIqZEA485Ux/pubhtml?gid=0&single=true";
  const response = await fetch(url);
  const data = await response.text();
  return {
    csvData: data,
  };
};
```

## Connecting the Tool to Your Agent

Now that we've created our tool, we need to connect it to our agent. Go back to your `agents/index.ts` file and update it:

1. Import the tool:

```typescript
import { getTransactionsTool } from "../tools";
```

2. Add the tool to your agent:

```typescript
export const financialAgent = new Agent({
  name: "Financial Assistant Agent",
  instructions: `ROLE DEFINITION
  // ... existing instructions ...
  
  TOOLS
  - Use the getTransactions tool to fetch financial transaction data.
  - Analyze the transaction data to answer user questions about their spending.`,
  model: openai("gpt-4o"),
  tools: { getTransactionsTool }, // Add our tool here
});
```

## Testing Your Tool

Let's test our tool and agent in the playground:

1. Make sure your development server is running with `npm run dev`
2. Open the playground at http://localhost:4111/
3. You can test the tool directly in the Tools tab to make sure it's working
4. Then, try asking your agent questions like:
   - "Can you show me my recent transactions?"
   - "How much did I spend on Amazon?"
   - "What was my largest transaction this month?"

Your agent should now be able to fetch the transaction data and answer questions about it. However, it doesn't yet have memory, so it won't remember previous conversations. We'll add that in the next step.
