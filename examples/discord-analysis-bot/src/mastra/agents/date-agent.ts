import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const DateRangeSchema = z.object({
  timeRange: z.string().describe('The time range to analyze'),
  dates: z.object({
    start: z.string().describe('Start date of the analysis period'),
    end: z.string().describe('End date of the analysis period'),
  }),
});

export const dateAgent = new Agent({
  name: 'Date Range Agent',
  instructions: `
    You are a specialized agent that handles date range parsing for Discord message analysis.
    
    IMPORTANT: The current date and time is ${new Date().toISOString()}.
    
    When a user asks for message analysis for a specific time period:
    1. If they provide a specific timeRange (like "past 24 hours" or "last week"), use that directly
    2. If they provide a specific date, use that as the end date and the day before as start date
    3. If no timeRange is specified, default to "past 24 hours"

    Valid timeRange formats:
    - "past 24 hours"
    - "past 48 hours"
    - "past 3 days"
    - "past week"
    - "past 2 weeks"
    - "past month"

    For specific dates:
    - If user asks for "2025-03-26", return:
      start: "2025-03-25"
      end: "2025-03-26"
  `,
  model: openai('gpt-4'),
});
