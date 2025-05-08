// <docs-tag name="full-workflow-example">
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { createStep, createWorkflow } from "../../workflows/cloudflare/src/index";
import { Mastra } from '@mastra/core/mastra'

type Env = {
	// Add your bindings here, e.g. Workers KV, D1, Workers AI, etc.
	MY_WORKFLOW: Workflow;
};

// User-defined params passed to your workflow
type Params = {
	email: string;
	metadata: Record<string, string>;
};

// <docs-tag name="workflow-entrypoint">
export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
    async run(event: WorkflowEvent<Params>, step: WorkflowStep) {

        const stepOne = createStep({
            id: 'stepOne',
            description: 'Doubles the input value',
            inputSchema: z.object({
                value: z.number(),
            }),
            outputSchema: z.object({
                doubledValue: z.number(),
            }),
            execute: async ({ inputData }) => {
                // Perform the step logic
				console.log('Input Data:', inputData);
                const doubledValue = inputData.value * 2;
                return { doubledValue };
            },
        });

        // Define the workflow
        const myWorkflow = createWorkflow({
            id: 'my-workflow',
            inputSchema: z.object({
                input: z.number(),
            }),
            outputSchema: z.object({
                doubledValue: z.number(),
            }),
            steps: [stepOne],
        }).then(stepOne).commit();

        // Initialize Mastra with the workflow
        const mastra = new Mastra({
            vnext_workflows: {
                'my-workflow': myWorkflow,
            },
        });

        // Create a workflow run
        const run = mastra.vnext_getWorkflow('my-workflow').createRun();

        // Start the workflow with trigger data
        const res = await run.start({
            inputData: { value: 90 },
        });

        // Return the workflow results
        return res.results || res;
    }
}
// </docs-tag name="workflow-entrypoint">

// <docs-tag name="workflows-fetch-handler">
export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		let url = new URL(req.url);

		if (url.pathname.startsWith('/favicon')) {
			return Response.json({}, { status: 404 });
		}

		// Get the status of an existing instance, if provided
		// GET /?instanceId=<id here>
		let id = url.searchParams.get('instanceId');
		if (id) {
			let instance = await env.MY_WORKFLOW.get(id);
			return Response.json({
				status: await instance.status(),
			});
		}

		// Spawn a new instance and return the ID and status
		let instance = await env.MY_WORKFLOW.create();
		// You can also set the ID to match an ID in your own system
		// and pass an optional payload to the Workflow
		// let instance = await env.MY_WORKFLOW.create({
		// 	id: 'id-from-your-system',
		// 	params: { payload: 'to send' },
		// });
		return Response.json({
			id: instance.id,
			details: await instance.status(),
		});
	},
};
// </docs-tag name="workflows-fetch-handler">
// </docs-tag name="full-workflow-example">
