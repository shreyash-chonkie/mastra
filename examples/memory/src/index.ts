import { randomUUID } from 'crypto';
import * as diff from 'diff';
import Readline from 'readline';

import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('memoryAgent');
// const threadId = `39873fbf-84d6-425e-8c1b-8afd798d72a4`;
const threadId = `27dfbd61-739a-4e57-bfed-5651469629fa`;
// const threadId = randomUUID();
console.log(threadId);
const resourceid = 'SOME_USER_ID';

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n👨‍🍳 Agent:`);
  let message = ``;
  let streamingWorkingMemoryChunks = false;
  for await (const chunk of res.textStream) {
    if (chunk.includes(`<working_memory>`)) streamingWorkingMemoryChunks = true;
    if (!streamingWorkingMemoryChunks) {
      process.stdout.write(chunk);
    }
    if (chunk.includes(`</working_memory>`)) streamingWorkingMemoryChunks = false;
    message += chunk;
  }
  console.log(`\n\n`);
  return message;
}

const workingMemoryTemplate = `<info>
  This is my short term memory. I will keep important info here about the current conversation. I need to update this memory as soon as possible as it is the default initialized working memory.
  I should keep this info block as well as the template structure of the rest of my memory so that I can remember how to update it over time.
</info>

<user>
  First name: ...
  Last name: ...
  Profession: ...
  Birth date: ...
  Age: ...
  Place of residence: ...
  Occupation: ...
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

const getWorkingMemoryWithInstruction =
  () => `The following text is your working memory for the current conversation. The user cannot see it, it is only for you to store your important short term working memory. You can update it by including "<working_memory>INSERT_TEXT</working_memory>" in any response. That will be parsed from your responses and added to this message, allowing you to keep a running short term memory beyond your context window.

**Instruction for Updating Working Memory:**

1. **Identify Relevant Information:** Whenever the user provides new information about themselves, their projects, preferences, or any other details that could be important for future interactions, identify this information as relevant for working memory.

2. **Use Designated Tags:** Format the relevant information using the \`<working_memory>...</working_memory>\` tags. For example:
   - If the user mentions their name: \`<working_memory>The user's name is X.</working_memory>\`
   - If the user describes a project: \`<working_memory>X is working on a memory system using a RAG strategy with a vector database.</working_memory>\`

3. **Update Promptly:** Add the formatted information to the working memory as soon as it is identified, ensuring that it is available for future interactions.

4. **Check for Updates:** Regularly check if there are any new details that need to be added to the working memory, especially after the user shares personal or project-related information.

5. **Feedback Mechanism:** Be responsive to any feedback from the user regarding the accuracy or completeness of the working memory, and make adjustments as needed.

6. **Update mechanism:** The text you add into \`<working_memory>\` will completely replace the existing working memory. Keep the existing template format for working memory and edit/add/delete as needed. 

7. **IMPORTANT:** You should know something about the user. If your working memory is empty, ask them their name at a minimum. You can store thoughts here that you infer from the users language. Don't be afraid to keep a record here. This is to help you talk with the user over long periods of time. Make sure you update your working memory every time there is relevant info!! <- This is extremely important!!!

8. **ALSO IMPORTANT:** You should keep your working memory in the following format, with an <info> block, <user> block, and <assistant_persona> block. Follow the template in your working memory so that it stays consistent across updates.

9. **Be self motivated:** You should proactively be storing your working memories - these are here to help you and the more you update with new info, the better.

<working_memory>
  ${workingMemoryBlock}
</working_memory>`;

async function main() {
  const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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
    if (matches) {
      const newMemory = matches[0].replace(/<\/?working_memory>/g, '').trim();
      const differences = diff.diffWords(workingMemoryBlock, newMemory);

      console.log(`Saving new working memory`);
      differences.forEach(part => {
        if (part.added) {
          console.log('Added: ' + part.value);
        } else if (part.removed && !part.value.includes(': ...')) {
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
