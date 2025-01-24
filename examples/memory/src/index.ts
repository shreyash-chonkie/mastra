import { randomUUID } from 'crypto';
import * as diff from 'diff';
import Readline from 'readline';

import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('memoryAgent');
// const threadId = `39873fbf-84d6-425e-8c1b-8afd798d72a4`;
// const threadId = `27dfbd61-739a-4e57-bfed-5651469629fa`; <- talked about mastra and gatsby
// const threadId = `ae222dee-3b21-42b3-b817-2d96e352360a`;
const threadId = randomUUID();
console.log(threadId);
const resourceid = 'SOME_USER_ID';

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n👨‍🍳 Agent:`);
  let message = ``;
  let bufferedMessage = ``;
  let streamingWorkingMemoryChunks = false;
  for await (const chunk of res.textStream) {
    if (bufferedMessage.trim() === `<working_memory>`) {
      streamingWorkingMemoryChunks = true;
      bufferedMessage = ``;
      process.stdout.write(`\nsaving working memory...\n`);
    }

    if (bufferedMessage.length > 9 && !bufferedMessage.startsWith(`<working_`)) {
      message += bufferedMessage;
      process.stdout.write(` ${bufferedMessage} `);
      bufferedMessage = ``;
    } else if (
      !streamingWorkingMemoryChunks &&
      ([`<`, `<work`, `<working`, `<working_`].includes(chunk) ||
        (bufferedMessage.length > 0 && [`work`, `working`, `working_`, `_`, `_memory`, `memory`, `memory>`, `>`]))
    ) {
      bufferedMessage += chunk;
      continue;
    }
    if (!streamingWorkingMemoryChunks) {
      process.stdout.write(chunk);
    }
    message += chunk;
    if (message.trim().endsWith(`</working_memory>`)) {
      streamingWorkingMemoryChunks = false;
      process.stdout.write(`saved working memory.\n`);
    }
  }
  console.log(`\n\n`);
  return message;
}

const workingMemoryTemplate = `<user>
  First name: ...
  Last name: ...
  Profession: ...
  Birth date: ...
  Age: ...
  Place of residence: ...
  Other relevant info: ...
  (I can add more key/value pairs here as needed): ...
</user>

<assistant_persona>
  user sentiment towards me: ...
  my preferences: ...
  when this conversation initially started: ...
  other relevant info: ...
</assistant_persona>
`;

let workingMemoryBlock = workingMemoryTemplate;

const getWorkingMemoryWithInstruction = () => `WORKING_MEMORY_SYSTEM_INSTRUCTION:
The following text is your working memory for the current conversation. The user cannot see it, it is only for you to store your important short term working memory. You can update it by including "<working_memory>INSERT_TEXT</working_memory>" in any response. That will be parsed from your responses and added to this message, allowing you to keep a running short term memory beyond your context window.

**Instruction for Updating Working Memory:**

1. **Identify Relevant Information:** Whenever the user provides new information about themselves, their projects, preferences, or any other details that could be important for future interactions, identify this information as relevant for working memory. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

2. **Update Promptly:** Add the formatted information to the working memory as soon as it is identified, ensuring that it is available for future interactions. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

3. **Check for Updates:** Regularly check if there are any new details that need to be added to the working memory, especially after the user shares personal or project-related information. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

4. **Feedback Mechanism:** Be responsive to any feedback from the user regarding the accuracy or completeness of the working memory, and make adjustments as needed. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

5. **Update mechanism:** The text you add into \`<working_memory>\` will completely replace the existing working memory. Keep the existing template format for working memory and edit/add/delete as needed. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

6. **IMPORTANT:** You should know something about the user. If your working memory is empty, ask them their name at a minimum. You can store thoughts here that you infer from the users language. Don't be afraid to keep a record here. This is to help you talk with the user over long periods of time. Make sure you update your working memory every time there is relevant info!! <- This is extremely important!!! PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

7. **ALSO IMPORTANT:** You should keep your working memory in the following format, with a <user> block and and <assistant_persona> block. Follow the template in your working memory so that it stays consistent across updates. Do not delete any of the empty keys or memory sections. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

8. **Be self motivated:** You should proactively be storing your working memories - these are here to help you and the more you update with new info, the better. When a user tells you something relevant to the working memory template PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE!

9. If the user tells you anything related to the keys in the working_memory block, PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE!

10. Make sure you also respond to the user, don't send any messages where there are only working memory updates.

<working_memory>
  ${workingMemoryBlock}
</working_memory>`;

async function main() {
  const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await logRes(
    await agent.stream(
      [
        {
          role: 'system',
          content: 'Chat with user started now',
        },
      ],
      {
        threadId,
        resourceid,
        context: [
          {
            role: 'system',
            content: getWorkingMemoryWithInstruction(),
          },
        ],
      },
    ),
  );

  while (true) {
    const answer: string = await new Promise(res => {
      rl.question('Message: ', answer => {
        res(answer);
      });
    });

    const response = await logRes(
      await agent.stream(answer, {
        threadId,
        resourceid,
        context: [
          {
            role: 'system',
            content: getWorkingMemoryWithInstruction(),
          },
        ],
      }),
    );

    const workingMemoryRegex = /<working_memory>([\s\S]*?)<\/working_memory>/g;
    const matches = response.match(workingMemoryRegex);
    const match = matches?.find(value => value !== `INSERT_TEXT`);
    if (match) {
      const newMemory = match.replace(/<\/?working_memory>/g, '').trim();
      const differences = diff.diffWords(workingMemoryBlock, newMemory);

      console.log(`Saving new working memory`);
      differences.forEach(part => {
        if (part.added) {
          console.log('Added: ' + part.value);
        } else if (part.removed && !part.value.trimEnd().endsWith('..')) {
          console.log('Removed: ' + part.value);
        }
      });
      workingMemoryBlock = newMemory;
    }
  }
}

// async function main() {
// await logRes(
//   await agent.stream(
//     log(
//       'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make? Please keep your answer brief, only give me the high level steps.',
//     ),
//     {
//       threadId,
//       resourceid,
//     },
//   ),
// );
//
// await logRes(
//   await agent.stream(
//     log(
//       "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.",
//     ),
//     {
//       threadId,
//       resourceid,
//     },
//   ),
// );
//
// await logRes(
//   await agent.stream(log('What did we cook before I went to my friends house?'), {
//     threadId,
//     resourceid,
//   }),
// );
// }

main();
