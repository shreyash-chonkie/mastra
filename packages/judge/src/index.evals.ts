import { Agent } from '@mastra/core';

import { mDescribe, mIt } from './eval/describe.js';
import { Judge } from './judge/index.js';
import { ContentSimilarityScorer } from './scorers/content-similarity.js';
import { JudgingConfig } from './types.js';

const judgeConfig: JudgingConfig = {
  name: 'Naive LLM Judge',
  aggregationStrategy: 'weighted',
  scorers: [
    {
      scorer: new ContentSimilarityScorer(),
      weight: 1,
      threshold: 0.5,
      category: 'content',
    },
    // {
    //     scorer: new StyleConsistencyScorer(),
    //     weight: 0.15,
    //     category: 'style'
    // },
    // {
    //     scorer: new ReadabilityScorer(),
    //     weight: 0.15,
    //     category: 'style'
    // }
  ],
  metadataCollectors: [
    {
      name: 'basicStats',
      collect: async response => ({
        length: response.length,
        wordCount: response.split(/\s+/).length,
        sentenceCount: response.split(/[.!?]+/).length,
      }),
    },
  ],
};

const judge = new Judge(judgeConfig);

const instructions = `
You are ColorHarmony, an expert color theory advisor. Your purpose is to help people create beautiful and functional color combinations.

Core color theory principles you follow:
- Complementary colors are directly opposite on the color wheel
- Analogous colors are directly next to each other
- Triadic colors are evenly spaced in thirds
- Split-complementary uses a base color and two colors adjacent to its complement

When recommending colors you must:
1. Always provide exactly 3 colors
2. Always use hex codes in #XXXXXX format
3. Ensure sufficient contrast between colors (minimum 4.5:1 for text readability)
4. Consider color psychology and cultural meanings

Format all responses as:
COLORS:
1. #[hex code] - [name of color]
2. #[hex code] - [name of color]
3. #[hex code] - [name of color]

HARMONY TYPE: [type]

COLOR THEORY EXPLANATION:
- [Explain each color choice]

RECOMMENDED USE CASE:
[Specific application]
`;

const agent = new Agent({
  name: 'ColorHarmony',
  instructions,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
});

const prompt = `I need a complementary color scheme for a sports brand. The main color should be a bright blue. `;

const reference = `
COLORS:
1. #0066FF - Bright Blue
2. #FF6600 - Orange
3. #FFFFFF - White

HARMONY TYPE: Complementary

COLOR THEORY EXPLANATION:
- The bright blue (#0066FF) and orange (#FF6600) are true complementary colors, exactly 180° apart on the color wheel
- White is added as a neutral to balance and provide contrast
- The blue conveys trust and energy while orange adds excitement and vitality

RECOMMENDED USE CASE:
Perfect for sports apparel and equipment branding, where the blue can be the primary color for uniforms and the orange for accents and highlights. White provides necessary contrast for logos and text.
`;

mDescribe('Naive LLM Judge', register => {
  register({
    agent,
    judge,
  });

  mIt(
    {
      reference,
      prompt,
    },
    async ({ response }: { response: string }) => {
      console.log('Yo', response);
    },
  );
});
