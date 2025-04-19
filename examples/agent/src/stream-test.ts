import { mastra } from './mastra';

const workflow = mastra.vnext_getWorkflow('workflow');

const run = workflow.createRun({});

const stream = run.stream({
  inputData: {
    prompt: 'Hello',
  },
});

for await (const chunk of stream.getDataStream()) {
  console.log(chunk);
}

// for await (const chunk of stream.assistantStream) {
//     console.log(chunk)
// }
