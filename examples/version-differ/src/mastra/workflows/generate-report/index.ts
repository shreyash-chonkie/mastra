import { Step } from '@mastra/core';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';

export const generateReport = new Step({
  id: 'generateReport',
  execute: async ({ context }) => {
    // Get the commits data from the previous step
    const commitsData = context.getStepResult('generateCommits');

    if (!commitsData) {
      throw new Error('No commits data found from previous step');
    }

    // The data is already grouped by area
    const commitsByArea = {};

    // Process the data to extract commits by area
    Object.keys(commitsData).forEach((area: string) => {
      if (!commitsByArea[area]) {
        commitsByArea[area] = [];
      }

      // Add all commits from this area
      commitsData[area].commits.forEach((commit: any) => {
        commitsByArea[area].push(commit);
      });
    });

    // Generate the release report
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    let markdownContent = `# Mastra Release - ${dateString}\n\n`;
    markdownContent += `Today we release a new latest version of Mastra.\n\n`;

    // Add sections for each area with commits
    Object.keys(commitsByArea)
      .sort()
      .forEach(area => {
        if (commitsByArea[area].length === 0) return;

        markdownContent += `## ${area}\n\n`;

        // Add each commit as a bullet point with PR link if available
        commitsByArea[area].forEach(commit => {
          const prLink = commit.pr_number
            ? `[#${commit.pr_number}](https://github.com/mastra-ai/mastra/pull/${commit.pr_number})`
            : '';

          // Use PR summary if available, otherwise use the commit message
          let description = commit.message;
          if (commit.pr_summary) {
            // Clean up the PR summary to directly state the change
            description = commit.pr_summary
              // Remove phrases like "This PR..." or "This pull request..."
              .replace(/^(This PR|This pull request|PR)\s+(\w+)\s+/i, '')
              // Capitalize first letter if it starts with a lowercase
              .replace(/^[a-z]/, match => match.toUpperCase());
          } else {
            // Clean up the commit message by removing PR number reference
            description = description.replace(/\\(#\\d+\\)$/, '').trim();
          }

          markdownContent += `- ${description} ${prLink}\n`;
        });

        markdownContent += '\n';
      });

    // Create releases directory if it doesn't exist
    const releasesDir = path.join(process.cwd(), 'releases');
    if (!existsSync(releasesDir)) {
      mkdirSync(releasesDir, { recursive: true });
    }

    // Write the markdown file
    const filePath = path.join(releasesDir, `${dateString}.md`);
    writeFileSync(filePath, markdownContent);

    console.log(`Release report written to ${filePath}`);

    return {
      filePath,
      markdownContent,
    };
  },
});
