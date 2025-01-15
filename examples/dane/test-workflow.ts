import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

// Step 1: Initial Document Review
const initialReview = new Step({
  id: 'initialReview',
  description: 'Initial scan and review of document',
  inputSchema: z.object({
    documentText: z.string(),
  }),
  outputSchema: z.object({
    documentLength: z.number(),
    initialIssues: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    const documentText = context.machineContext?.triggerData?.documentText;
    if (!mastra?.llm) throw new Error('LLM not available');

    const llm = mastra.llm({
      provider: 'OPEN_AI',
      name: 'gpt-4o',
    });

    const result = await llm.generate(
      [
        {
          role: 'system',
          content: 'You are a professional document reviewer. Scan the document and identify initial issues.',
        },
        {
          role: 'user',
          content: documentText,
        },
      ],
      {
        output: z.object({
          documentLength: z.number(),
          initialIssues: z.array(z.string()),
        }),
      },
    );

    return result.object;
  },
});

// Step 2: Grammar and Spelling Check
const grammarCheck = new Step({
  id: 'grammarCheck',
  description: 'Check spelling and grammar',
  outputSchema: z.object({
    grammarIssues: z.array(z.string()),
    spellingIssues: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    const documentText = context.machineContext?.triggerData?.documentText;
    if (!mastra?.llm) throw new Error('LLM not available');

    const llm = mastra.llm({
      provider: 'OPEN_AI',
      name: 'gpt-4o',
    });

    const result = await llm.generate(
      [
        {
          role: 'system',
          content: 'You are a professional editor. Check the text for grammar and spelling issues.',
        },
        {
          role: 'user',
          content: documentText,
        },
      ],
      {
        output: z.object({
          grammarIssues: z.array(z.string()),
          spellingIssues: z.array(z.string()),
        }),
      },
    );

    return result.object;
  },
});

// Step 3: Format Check
const formatCheck = new Step({
  id: 'formatCheck',
  description: 'Check document formatting',
  outputSchema: z.object({
    formatIssues: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    const documentText = context.machineContext?.triggerData?.documentText;
    if (!mastra?.llm) throw new Error('LLM not available');

    const llm = mastra.llm({
      provider: 'OPEN_AI',
      name: 'gpt-4o',
    });

    const result = await llm.generate(
      [
        {
          role: 'system',
          content: 'You are a formatting specialist. Check the document for formatting consistency.',
        },
        {
          role: 'user',
          content: documentText,
        },
      ],
      {
        output: z.object({
          formatIssues: z.array(z.string()),
        }),
      },
    );

    return result.object;
  },
});

// Step 4: Final Review
const finalReview = new Step({
  id: 'finalReview',
  description: 'Perform final document review',
  outputSchema: z.object({
    finalReport: z.object({
      grammarIssues: z.array(z.string()),
      spellingIssues: z.array(z.string()),
      formatIssues: z.array(z.string()),
      recommendations: z.array(z.string()),
    }),
  }),
  execute: async ({ context, mastra }) => {
    const grammarResults = context.machineContext?.getStepPayload('grammarCheck');
    const formatResults = context.machineContext?.getStepPayload('formatCheck');

    if (!mastra?.llm) throw new Error('LLM not available');

    const llm = mastra.llm({
      provider: 'OPEN_AI',
      name: 'gpt-4o',
    });

    const result = await llm.generate(
      [
        {
          role: 'system',
          content: 'You are a senior editor. Review all findings and provide final recommendations.',
        },
        {
          role: 'user',
          content: JSON.stringify({ grammarResults, formatResults }),
        },
      ],
      {
        output: z.object({
          finalReport: z.object({
            grammarIssues: z.array(z.string()),
            spellingIssues: z.array(z.string()),
            formatIssues: z.array(z.string()),
            recommendations: z.array(z.string()),
          }),
        }),
      },
    );

    return result.object;
  },
});

// Create and configure workflow
const proofreadingWorkflow = new Workflow({
  name: 'document-proofreading',
  triggerSchema: z.object({
    documentText: z.string(),
  }),
});

// Build workflow steps
proofreadingWorkflow.step(initialReview).then(grammarCheck).then(formatCheck).then(finalReview);

proofreadingWorkflow.commit();
