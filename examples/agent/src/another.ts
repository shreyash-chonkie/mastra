import { MastraClient } from '@mastra/client-js';
import { randomUUID } from 'crypto';

async function main() {
  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  const a2a = client.getA2A();

  const a = await a2a.getAgentCard();

  console.log(JSON.stringify(a, null, 2));

  const taskId = randomUUID();

  const task = await a2a.sendTask({
    id: taskId,
    message: {
      role: 'user',
      parts: [{ type: 'text', text: `What's the weather like in San Francisco?` }],
    },
  });

  console.log(JSON.stringify(task, null, 2));

  const getTask = await a2a.getTask({ id: taskId });

  console.log(JSON.stringify(getTask, null, 2));
}

main();
