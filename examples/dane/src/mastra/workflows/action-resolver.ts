import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

import { github } from '../integrations/index.js';

const failedRunsSchema = z.array(
  z.object({
    name: z.string(),
    conclusion: z.string(),
    logs_url: z.string(),
    html_url: z.string(),
  }),
);

const actionResultsSchema = z.array(
  z.object({
    name: z.string(),
    logs: z.string(),
    html_url: z.string(),
  }),
);

const solutionsSchema = z.array(
  z.object({
    actionName: z.string(),
    solution: z.string(),
    html_url: z.string(),
  }),
);

export const githubActionResolver = new Workflow({
  name: 'github-action-resolver',
  triggerSchema: z.object({
    repo: z.string(),
    owner: z.string(),
    pull_number: z.number(),
  }),
});

const getFailedActions = new Step({
  id: 'getFailedActions',
  outputSchema: z.object({
    failedRuns: failedRunsSchema,
    count: z.number(),
  }),
  execute: async ({ context }) => {
    const client = await github.getApiClient();

    const pr = await client.pullsGet({
      path: {
        owner: context?.machineContext?.triggerData?.owner,
        repo: context?.machineContext?.triggerData?.repo,
        pull_number: context?.machineContext?.triggerData?.pull_number,
      },
    });

    if (pr.error || !pr.data) {
      console.log('pr error=', pr.error);
      throw new Error('Failed to get PR');
    }

    const runs = await client.actionsListWorkflowRunsForRepo({
      path: {
        owner: context?.machineContext?.triggerData?.owner,
        repo: context?.machineContext?.triggerData?.repo,
      },
      query: {
        head_sha: pr.data.head.sha,
      },
    });

    if (runs.error || !runs.data) {
      console.log('runs error=', runs.error);
      throw new Error('Failed to get workflow runs');
    }

    const failedRuns = runs.data.workflow_runs
      .filter(run => run.conclusion === 'failure')
      .map(run => ({
        name: run.name!,
        conclusion: run.conclusion!,
        logs_url: run.logs_url,
        html_url: run.html_url,
      }));

    return { failedRuns, count: failedRuns.length };
  },
});

const noFailedActions = new Step({
  id: 'noFailedActions',
  execute: async ({ context }) => {
    const client = await github.getApiClient();

    await client.issuesCreateComment({
      path: {
        owner: context?.machineContext?.triggerData?.owner,
        repo: context?.machineContext?.triggerData?.repo,
        issue_number: context?.machineContext?.triggerData?.pull_number,
      },
      body: {
        body: `# Action Failure Analysis 🔍\n\n${'No failed actions found!'}`,
      },
    });
  },
});

const getActionLogs = new Step({
  id: 'getActionLogs',
  outputSchema: z.object({
    actionResults: actionResultsSchema,
  }),
  execute: async ({ context }) => {
    const parentStep = context?.machineContext?.stepResults?.getFailedActions;
    if (!parentStep || parentStep.status !== 'success') {
      return { actionResults: [] };
    }

    const actionResults = await Promise.all(
      (parentStep.payload.failedRuns as z.infer<typeof failedRunsSchema>).map(async run => {
        const response = await fetch(run.logs_url);
        const logs = await response.text();
        return {
          name: run.name,
          logs,
          html_url: run.html_url,
        };
      }),
    );

    return { actionResults };
  },
});

const getSolutions = new Step({
  id: 'getSolutions',
  outputSchema: z.object({
    solutions: solutionsSchema,
  }),
  execute: async ({ context, mastra }) => {
    const parentStep = context?.machineContext?.stepResults?.getActionLogs;
    if (!parentStep || parentStep.status !== 'success') {
      return { solutions: [] };
    }

    const daneActionResolver = mastra?.agents?.daneActionResolver;

    if (!daneActionResolver) {
      throw new Error('Dane action resolver not found');
    }

    const solutions = await Promise.all(
      (parentStep.payload.actionResults as z.infer<typeof actionResultsSchema>).map(async action => {
        const res = await daneActionResolver?.generate(
          `
          Analyze this failed GitHub Action:
          Action Name: ${action.name}
          Action URL: ${action.html_url}
          
          Logs:
          ${action.logs}

          Please provide a clear solution to fix this failed action.
          `,
          {
            output: z.object({
              solution: z.string(),
            }),
          },
        );

        return {
          actionName: action.name,
          solution: res?.object?.solution as string,
          html_url: action.html_url,
        };
      }),
    );

    return { solutions };
  },
});

const postSolutions = new Step({
  id: 'postSolutions',
  execute: async ({ context }) => {
    const parentStep = context?.machineContext?.stepResults?.getSolutions;
    if (!parentStep || parentStep.status !== 'success') {
      return;
    }

    const client = await github.getApiClient();

    const solutionsComment = (parentStep.payload.solutions as z.infer<typeof solutionsSchema>)
      .map(
        solution =>
          `## Failed Action: ${solution.actionName}\n` +
          `Action URL: ${solution.html_url}\n\n` +
          `### Solution:\n${solution.solution}\n\n` +
          `---\n`,
      )
      .join('\n');

    await client.issuesCreateComment({
      path: {
        owner: context?.machineContext?.triggerData?.owner,
        repo: context?.machineContext?.triggerData?.repo,
        issue_number: context?.machineContext?.triggerData?.pull_number,
      },
      body: {
        body: `# Action Failure Analysis 🔍\n\n${solutionsComment}`,
      },
    });
  },
});

githubActionResolver
  .step(getFailedActions)
  .then(getActionLogs, {
    when: {
      ref: {
        step: {
          id: 'getFailedActions',
        },
        path: 'count',
      },
      query: { $gt: 0 },
    },
  })
  .then(getSolutions)
  .then(postSolutions)
  .after(getFailedActions)
  .step(noFailedActions, {
    when: {
      ref: {
        step: {
          id: 'getFailedActions',
        },
        path: 'count',
      },
      query: { $eq: 0 },
    },
  })
  .commit();
