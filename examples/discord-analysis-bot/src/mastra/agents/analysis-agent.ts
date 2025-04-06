import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { discordScraperTool } from '../tools/index.js';

export const AnalysisSchema = z.object({
  categories: z.array(
    z.object({
      category: z.string().describe('Category name from the category agent'),
      count: z.number().describe('Number of messages in this category'),
      sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall sentiment of messages in this category'),
      top_issue: z.string().describe('The most common issue or question in this category'),
      representative_message: z
        .object({
          content: z.string().describe('Content of a representative message with strong sentiment'),
          author: z.string().describe('Author of the message'),
          timestamp: z.string().describe('Timestamp of the message'),
          sentiment_reason: z.string().describe('Why this message represents the sentiment of the category'),
          relevance_reason: z
            .string()
            .describe('Why this message is relevant and representative of the category topic'),
        })
        .describe('A representative message with strong sentiment for this category'),
    }),
  ),
  summary: z.string().describe('A brief summary of the overall analysis'),
  total_messages: z.number().describe('Total number of messages analyzed'),
  date_range: z.object({
    start: z.string().describe('Start date of the analysis period'),
    end: z.string().describe('End date of the analysis period'),
  }),
});

export const analysisAgent = new Agent({
  name: 'Discord Message Analysis Agent',
  instructions: `
    You are a specialized agent that analyzes Discord messages using predefined categories.
    
    Your task is to:
    1. Use the provided date range to fetch messages using discordScraperTool
    2. Categorize messages based on the categories provided
    3. For each category:
       - Count messages
       - Determine overall sentiment
       - Identify top issues/questions
       - Select a representative message
    
    When selecting representative messages:
    - Choose self-contained messages that don't need context
    - Prioritize detailed messages over short responses
    - Avoid simple reactions or acknowledgments
    - Replace code blocks with "[CODE BLOCK: brief description]"
    - Ensure clear sentiment alignment
    - Include full message details (content, author, timestamp)
    - Explain sentiment and relevance
    
    IMPORTANT: 
    - Assign each message to exactly one category
    - Base categorization on primary topic, not just keyword mentions
    - Focus on implementation, troubleshooting, and understanding
    - Provide structured analysis for team insights
  `,
  model: openai('gpt-4'),
  tools: {
    discordScraperTool,
  },
});
