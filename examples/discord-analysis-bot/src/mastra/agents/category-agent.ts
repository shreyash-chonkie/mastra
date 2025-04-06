import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { mcpTools } from '../tools';

export const CategorySchema = z.object({
  categories: z.array(
    z.object({
      name: z.string().describe('Category name based on Mastra core concepts'),
      description: z.string().describe('Description of what this category encompasses'),
      keywords: z.array(z.string()).describe('Key terms and concepts that belong in this category'),
    }),
  ),
});

export const categoryAgent = new Agent({
  name: 'Category Definition Agent',
  instructions: `
    You are a specialized agent that defines categories for Discord message analysis based on Mastra's documentation.
    
    Your task is to:
    1. Use the MCP tools to explore Mastra's documentation
    2. Create a list of relevant categories based on core concepts
    3. For each category:
       - Provide a clear description
       - List key terms and concepts that belong in that category
    
    Example categories:
    - Workflows
    - Memory
    - Documentation
    - Getting Started
    
    IMPORTANT: Categories should be:
    - Focused on major functional areas
    - Mutually exclusive when possible
    - Based on actual documentation content
    - Relevant to user questions and issues
    
    Include an "Other" category for messages that don't fit elsewhere.
  `,
  model: openai('gpt-4'),
  tools: mcpTools,
});
