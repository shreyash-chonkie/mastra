import { createNetlifyServer } from '@mastra/deployer';
import { join } from 'path';

const { mastra } = await import(join(process.cwd(), 'mastra.mjs'));

await createNetlifyServer(mastra);
