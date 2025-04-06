import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

import { dateAgent, DateRangeSchema } from '../agents/date-agent.js';
import { categoryAgent, CategorySchema } from '../agents/category-agent.js';
import { analysisAgent, AnalysisSchema } from '../agents/analysis-agent.js';

// Define individual steps
const parseDates = new Step({
  id: 'parseDates',
  execute: async ({ context }) => {
    const triggerData = context?.triggerData;
    const timeRange = triggerData.timeRange || triggerData.specificDate || 'past 24 hours';
    return await dateAgent.generate(`Parse the time range: ${timeRange}`);
  },
});

const defineCategories = new Step({
  id: 'defineCategories',
  execute: async ({ context }) => {
    if (context?.steps.parseDates.status !== 'success') {
      throw new Error('Date parsing failed');
    }
    return await categoryAgent.generate('Define categories based on Mastra documentation');
  },
});

const analyzeMessages = new Step({
  id: 'analyzeMessages',
  execute: async ({ context }) => {
    if (context?.steps.parseDates.status !== 'success' || context?.steps.defineCategories.status !== 'success') {
      throw new Error('Previous steps failed');
    }
    const dateRange = context.steps.parseDates.output.dates;
    const categories = context.steps.defineCategories.output.categories;
    return await analysisAgent.generate(
      `Analyze messages from ${dateRange.start} to ${dateRange.end} using categories: ${categories.map(c => c.name).join(', ')}`,
    );
  },
});

// Create the workflow
export const discordAnalysisWorkflow = new Workflow({
  name: 'discord-analysis',
  triggerSchema: z.object({
    timeRange: z.string().optional(),
    specificDate: z.string().optional(),
  }),
});

// Chain the steps
discordAnalysisWorkflow.step(parseDates).then(defineCategories).then(analyzeMessages).commit();
