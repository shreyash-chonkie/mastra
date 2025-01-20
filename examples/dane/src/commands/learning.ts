import { mastra } from '../mastra/index.js';

export async function learning() {
  const workflow = mastra.getWorkflow('learning');

  const { start } = workflow.createRun();

  const res = await start();

  console.log(res);

  // await workflow.watch(runId, {
  //     onTransition: async ({ activePaths, context }) => {
  //         for (const path of activePaths) {
  //             const ctx = context.stepResults?.[path.stepId]?.status;
  //             if (ctx === 'suspended') {
  //                 // Handle suspension
  //                 if (path.stepId === 'stepC2' && ctx === 'suspended') {
  //                     const confirmed = await confirm({ message: 'Do you want to change the message?' });
  //                     if (confirmed) {
  //                         await workflow.resume({
  //                             stepId: path.stepId,
  //                             runId,
  //                             context: {
  //                                 confirm: true,
  //                             },
  //                         });
  //                     }
  //                 }
  //             }
  //         }
  //     },
  // });
}
