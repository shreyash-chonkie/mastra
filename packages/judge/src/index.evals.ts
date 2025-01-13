import { Agent } from '@mastra/core';

import { mDescribe, mIt } from './eval/describe.js';
import { mExpect } from './eval/expect.js';
import { Judge } from './judge/index.js';
import { CompletenessScorer } from './scorers/completeness.js';
import { ContentSimilarityScorer } from './scorers/content-similarity.js';
import { KeywordCoverageScorer } from './scorers/keyword-coverage.js';
import { ReadabilityScorer } from './scorers/readability.js';
import { StructuralScorer } from './scorers/structural.js';
import { StyleConsistencyScorer } from './scorers/style.js';
import { ToneConsistencyScorer } from './scorers/tone.js';
import { JudgingConfig } from './types.js';

const judgeConfig: JudgingConfig = {
  name: 'Naive LLM Judge',
  aggregationStrategy: 'weighted',
  scorers: [
    {
      scorer: new ContentSimilarityScorer(),
      weight: 0.35,
      threshold: 0.5,
      category: 'content',
    },
    {
      scorer: new KeywordCoverageScorer(),
      weight: 0.25,
      category: 'content',
    },
    {
      scorer: new ToneConsistencyScorer(),
      weight: 0.15,
      category: 'style',
    },
    {
      scorer: new StructuralScorer(),
      weight: 0.1,
      category: 'style',
    },
    {
      scorer: new ReadabilityScorer(),
      weight: 0.05,
      category: 'style',
    },
    {
      scorer: new StyleConsistencyScorer(),
      weight: 0.05,
      category: 'style',
    },
    {
      scorer: new CompletenessScorer(),
      weight: 0.05,
      category: 'style',
    },
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
You are DocSimplifier, an expert at rewriting technical content for different audiences. Your goal is to make complex topics understandable while preserving key information.

For every piece of technical content you receive:
1. Analyze the technical complexity and key terms
2. Rewrite it for the requested level (Elementary/High School/Technical)
3. Preserve all important concepts but adjust vocabulary appropriately
4. Use examples and analogies for complex ideas
5. Maintain a consistent, level-appropriate tone

Always format your response exactly as:
READING LEVEL: [Elementary/High School/Technical]

SIMPLIFIED TEXT:
[Your rewrite]

KEY TERMS PRESERVED:
- [Term]: [How you explained/modified it]
`;

const instructionsIteration1 = `
You are DocSimplifier, an expert at rewriting technical content for elementary students. Follow these precise rules:

SENTENCE STRUCTURE RULES:
- Use exactly 10-12 words per sentence
- Start each sentence with a subject + action pattern
- End each sentence with one key piece of information
- Use simple present tense for all explanations
- Connect ideas with words like "then" and "next"

PARAGRAPH STRUCTURE:
1. First paragraph: Introduce the main concept (2 sentences)
2. Middle paragraphs: Explain process (4-5 sentences)
3. Final paragraph: Summarize main idea (1-2 sentences)

VOCABULARY RULES:
- Define each technical term once
- Use the same term consistently throughout
- Choose grade 3-5 vocabulary
- Avoid idioms or metaphors

Your response must use this format:
READING LEVEL: Elementary

SIMPLIFIED TEXT:
[Text following above rules]

KEY TERMS PRESERVED:
- [Term]: [Simple definition used in text]
`;

const instructionsIteration2 = `
You are DocSimplifier, an expert at rewriting technical content for elementary students.

CONTENT PRESERVATION RULES:
- Keep ALL key technical terms but add simple explanations after them
- Maintain the exact sequence of processes from the original
- Preserve all relationships between concepts
- Include every input and output mentioned
- Mirror the original text's structure of explanation

SENTENCE STRUCTURE RULES:
- Use exactly 10-12 words per sentence
- Start each sentence with a subject + action pattern
- Use simple present tense
- Connect ideas with "then" and "next"

TECHNICAL TERM FORMAT:
- First mention: [Technical term] (which means [simple explanation])
- Later mentions: Just use [Technical term]
- List EVERY technical term from original in Key Terms

Your response must use this format:
READING LEVEL: Elementary

SIMPLIFIED TEXT:
[Text following above rules]

KEY TERMS PRESERVED:
- [Term]: [EXACT definition from original, then simple explanation]
`;

const instructionsToTest = [instructions, instructionsIteration1, instructionsIteration2];

const agent = new Agent({
  name: 'DocSimplifier',
  instructions: instructionsToTest[1]!,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
});

const prompt = `
Rewrite for elementary level:
'Photosynthesis is the process by which plants convert solar energy into chemical energy, using chlorophyll to transform carbon dioxide and water into glucose and oxygen.'
`;

const reference = `
READING LEVEL: Elementary

SIMPLIFIED TEXT:
Plants use sunlight to make their own food. Plants need water to make their food. Plants take in air to make their food. Plants mix these things inside their leaves. Plants use chlorophyll to process everything. Plants create sugar for their energy. Plants release oxygen into the air. Plants do this every single day.

KEY TERMS PRESERVED:
- Photosynthesis: "making their own food"
- Chlorophyll: "green helper for processing"
- Carbon dioxide: "air they take in"
- Glucose: "sugar for energy"
- Oxygen: "clean air released"
`;

mDescribe('DocSimplifier Evals', register => {
  register({
    agent,
    judge,
  });

  mIt(
    {
      reference,
      prompt,
    },
    async ({ response, judgement }) => {
      console.log(response, judgement.feedback);
      mExpect(judgement).toHaveConfidenceAbove(0.7);
    },
  );

  mIt(
    {
      reference: `
      READING LEVEL: Elementary

      SIMPLIFIED TEXT:
      The Industrial Revolution was a time when the way people made things changed completely. Before, people made everything by hand. Then, new machines were invented to make things in factories. This big change made more people move to cities to work. The new machines and factories changed how everyone lived and worked.

      KEY TERMS PRESERVED:
      - Industrial Revolution: "time when the way people made things changed"
      - Manual production: "made everything by hand"
      - Machine manufacturing: "machines were invented to make things"
      - Urbanization: "people move to cities"
      - Technological innovation: "new machines and factories"
    `,
      prompt: `The Industrial Revolution was characterized by the transition from manual production methods to machine manufacturing, significantly impacting socioeconomic conditions through urbanization and technological innovation.`,
    },
    async ({ response, judgement }) => {
      console.log(response, judgement.feedback);
      mExpect(judgement).toHaveConfidenceAbove(0.7);
    },
  );

  mIt(
    {
      reference: `
      READING LEVEL: Elementary

      SIMPLIFIED TEXT:
      The Pythagorean theorem helps us find distances in right triangles. A right triangle has one corner that makes a perfect square shape. The longest side of this triangle is called the hypotenuse. If you multiply this longest side by itself, it equals the other two sides each multiplied by themselves and then added together. We write this as a² + b² = c², where c is the longest side.

      KEY TERMS PRESERVED:
      - Pythagorean theorem: "rule for finding distances in right triangles"
      - Right triangle: "triangle with one corner that makes a perfect square shape"
      - Hypotenuse: "longest side of the triangle"
      - Square (mathematical): "multiply a number by itself"
      - Equation (a² + b² = c²): "write this as a² + b² = c²"
    `,
      prompt: `The Pythagorean theorem states that in a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides, expressed as a² + b² = c².`,
    },
    async ({ response, judgement }) => {
      console.log(response, judgement.feedback);
      mExpect(judgement).toHaveConfidenceAbove(0.7);
    },
  );
});
