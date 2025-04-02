import { z } from 'zod';
import { ExecuteToolInputFn, Tool } from '@/lib/realtime';

type CreateToolFn<I> = (fn: ExecuteToolInputFn<I>) => Tool<I>;

const renderDetailsSchema = z.object({
  name: z.string(),
  description: z.string(),
  attributes: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
});

export type RenderDetailsInput = z.infer<typeof renderDetailsSchema>;

export const renderDetailsTool: CreateToolFn<RenderDetailsInput> = fn => ({
  id: 'render_details',
  inputSchema: renderDetailsSchema,
  description: 'Render a details page for the user',
  execute: async ({ name, description, attributes }, { connection }) => {
    fn({ name, description, attributes }, { connection });

    return {
      message: 'Details rendered',
    };
  },
});

const renderListSchema = z.object({
  items: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
});

export type RenderListInput = z.infer<typeof renderListSchema>;

export const renderListTool: CreateToolFn<RenderListInput> = fn => ({
  id: 'render_list',
  inputSchema: renderListSchema,
  description: 'Render a list for the user',
  execute: async ({ items }, { connection }) => {
    fn({ items }, { connection });

    return {
      message: 'List rendered',
    };
  },
});

const renderTableSchema = z.object({
  columns: z.array(z.string()),
  data: z.array(z.array(z.string())),
});

export type RenderTableInput = z.infer<typeof renderTableSchema>;

export const renderTableTool: CreateToolFn<RenderTableInput> = fn => ({
  id: 'render_table',
  inputSchema: renderTableSchema,
  description: 'Render a table for the user',
  execute: async ({ columns, data }, { connection }) => {
    fn({ columns, data }, { connection });

    return {
      message: 'Table rendered',
    };
  },
});

const renderChartSchema = z.object({
  data: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
    }),
  ),
});

export type RenderChartInput = z.infer<typeof renderChartSchema>;

export const renderChartTool: CreateToolFn<RenderChartInput> = fn => ({
  id: 'render_chart',
  inputSchema: renderChartSchema,
  description: 'Render a chart for the user',
  execute: async ({ data }, { connection }) => {
    fn({ data }, { connection });

    return {
      message: 'Chart rendered',
    };
  },
});
