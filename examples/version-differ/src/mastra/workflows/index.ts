import { Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { generateCommits } from './generate-commits';
import { generateReport } from './generate-report';

export const workflow = new Workflow({
  name: 'changelog-generator',
  triggerSchema: z.object({
    oldVersion: z.string(),
    newVersion: z.string(),
  }),
});

workflow.step(generateCommits).then(generateReport).commit();
