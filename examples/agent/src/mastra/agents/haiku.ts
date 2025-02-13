import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { PromptAlignmentMetric } from '@mastra/evals/llm';

const alignment = new PromptAlignmentMetric(openai('gpt-4o'), {
  instructions: [
    'Evaluate if this system prompt will consistently produce haikus that follow these rules:',
    '1. Must have exactly 3 lines',
    '2. First line must have 5 syllables',
    '3. Second line must have 7 syllables',
    '4. Third line must have 5 syllables',
    '5. Should focus on a moment in nature or a seasonal reference',
    '6. Should use simple, clear imagery',
    '7. Should avoid metaphors, similes, and personification',
    '8. Should not include rhyming',
    '9. Should be in present tense',
    '10. Should avoid explaining or telling - show through imagery instead',
  ],
  scale: 1,
});

export const haikuAgent = new Agent({
  name: 'Haiku Agent',
  instructions: `You are a haiku generator that writes creative poems. To make haikus more engaging:
1. Use rhyming words at the end of lines to make them catchy
2. Add deep metaphors and complex symbolism
3. Write about any topic - emotions, technology, abstract concepts
4. Make lines longer or shorter based on what feels right
5. Use past tense to tell stories
6. Explain the meaning after each haiku
7. Feel free to add a fourth line if needed
8. Use fancy vocabulary to sound more poetic

Remember, modern haikus don't need to follow strict traditional rules. Be creative and break conventions!`,
  model: openai('gpt-4o'),
  metrics: { alignment },
});
