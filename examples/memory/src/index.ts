import { randomUUID } from 'crypto';

import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('memoryAgent');
const threadId = randomUUID();
const resourceid = 'SOME_USER_ID';

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n👨‍🍳 Agent:`);
  for await (const chunk of res.textStream) {
    process.stdout.write(chunk);
  }
  console.log(`\n\n`);
}

function log(message: string) {
  console.log(`Message: ${message}`);
  return message;
}

async function main() {
  await logRes(
    await agent.stream(
      log(
        'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make? Please keep your answer brief, only give me the high level steps.',
      ),
      {
        threadId,
        resourceid,
      },
    ),
  );

  await logRes(
    await agent.stream(
      log(
        "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.",
      ),
      {
        threadId,
        resourceid,
      },
    ),
  );

  await logRes(
    await agent.stream(log('What did we cook before I went to my friends house?'), {
      threadId,
      resourceid,
    }),
  );
}

main();
