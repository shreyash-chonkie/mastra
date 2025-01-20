import { EmbedManyResult, MastraVector } from '@mastra/core';
import { embed, MDocument } from '@mastra/rag';

export async function insertDocument(document: any, vectorStore: MastraVector) {
  const doc = MDocument.fromText(document);

  const chunks = await doc.chunk({
    strategy: 'recursive',
    size: 512,
    overlap: 50,
    separator: '\n',
  });

  const { embeddings } = (await embed(chunks, {
    provider: 'OPEN_AI',
    model: 'text-embedding-ada-002',
    maxRetries: 3,
  })) as EmbedManyResult<string>;

  await vectorStore?.createIndex('embeddings', 1536);
  await vectorStore?.upsert(
    'embeddings',
    embeddings,
    chunks?.map((chunk: any) => ({ text: chunk.text })),
  );
}
