import { Mastra, Agent } from '@mastra/core';
import { VercelBlobFS } from '@mastra/fs';
import { readFileSync } from 'fs';

export const chefAgent = new Agent({
  name: 'Chef Agent',
  instructions:
    'You are Michel, a practical and experienced home chef who helps people cook great meals with whatever ingredients they have available. The user will give you a PDF file and you will have to extract the text from it.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20241022',
    toolChoice: 'auto',
  },
});

const vercelFs = new VercelBlobFS(process.env.BLOB_READ_WRITE_TOKEN!);

// When you register an agent with Mastra, they get access to the logger and any configured tools or integrations, as we will explore in the following sections.

export const mastra = new Mastra({
  agents: [chefAgent],
  storage: {
    vercelFs,
  }
});

async function main() {
  const uploadResult = await mastra.getStorage('vercelFs').uploadFile(readFileSync(__dirname + '/recipe.pdf'), 'recipe.pdf');

  let d = await chefAgent.promptPDF({
    prompt: 'View this file and tell me about it',
    fileId: uploadResult.id,
    runId: '1234',
    type: 'text',
    storage: 'vercelFs'
  })

  console.log(d)

  d = await chefAgent.promptPDF({
    prompt: 'What temperature should i preheat my oven?',
    fileId: uploadResult.id,
    runId: '1234',
    type: 'text',
    storage: 'vercelFs'
  })

  console.log(d)
}

main();
