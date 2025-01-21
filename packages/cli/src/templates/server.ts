import { createNodeServer } from '@mastra/deployer';
import _path, { join } from 'path';
import { fileURLToPath as _fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const mastraPath = pathToFileURL(join(process.cwd(), 'mastra.mjs')).href;
const { mastra } = await import(mastraPath);

await createNodeServer(mastra);
