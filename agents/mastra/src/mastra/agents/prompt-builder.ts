import { createAnthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const promptBuilder: Agent = new Agent({
  name: 'Prompt Builder',
  model: anthropic('claude-3-5-sonnet-20241022'),
  instructions: `
        You are a prompt improvement specialist. When given a system prompt:
        1. Return ONLY:
           - The improved prompt
           - A single paragraph explaining the key improvements made

        2. Focus on making prompts:
           - Clear and precise
           - Well-structured
           - Concise yet complete
           - Safety-aware

        Format your response as:
        [IMPROVED PROMPT]
        <prompt text>

        [EXPLANATION]
        <single paragraph>
    `,
});
