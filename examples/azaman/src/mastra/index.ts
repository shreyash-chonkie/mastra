import { embed, Mastra } from '@mastra/core';
import { MDocument, PgVector } from '@mastra/rag';

import { generateAnswerAgent, generateAnswerAgentWithMemory } from './agents/generate-answer';

interface DocumentChunk {
  text: string;
}

// Initialize RAG components
const pgVector = new PgVector(process.env.DB_URL!);

// Load and index the documentation
export const loadDocs = async () => {
  try {
    const response = await fetch('https://mastra.ai/llms.txt');
    const text = await response.text();
    const doc = MDocument.fromText(text);

    console.log('doc');

    // Create chunks
    const chunks = await doc.chunk({
      strategy: 'recursive',
      size: 512,
      overlap: 50,
    });

    console.log('chunks');

    // Generate embeddings and store them
    const embedResult = await embed(chunks, {
      provider: 'OPEN_AI',
      model: 'text-embedding-ada-002',
      maxRetries: 3,
    });

    console.log('embedResult');

    const vectorStore = mastra.getVector('pgVector');

    if ('embeddings' in embedResult) {
      await vectorStore.createIndex('embeddings', 1536);
      await vectorStore.upsert(
        'embeddings',
        embedResult.embeddings,
        chunks.map((chunk: DocumentChunk) => ({ text: chunk.text })),
      );
      await pgVector.upsert('embeddings', embedResult.embeddings);
    } else {
      throw new Error('Failed to generate embeddings');
    }
    console.log('Documentation loaded and indexed successfully');
  } catch (error) {
    console.error('Failed to load documentation:', error);
  }
};

// Initialize Mastra
export const mastra = new Mastra({
  agents: { generateAnswerAgent, generateAnswerAgentWithMemory },
  vectors: { pgVector },
});
