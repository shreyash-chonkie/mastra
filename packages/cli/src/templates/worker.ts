import { createCloudflareServer } from '@mastra/deployer';
import { join } from 'path';
import { pathToFileURL } from 'url';

const mastraPath = pathToFileURL(join(process.cwd(), 'mastra.mjs')).href;
const { mastra } = await import(mastraPath);

await createCloudflareServer(mastra);
