import { Step } from '@mastra/core';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';
import https from 'https';

export const generateCommits = new Step({
  id: 'generateCommits',
  execute: async ({ context, mastra }) => {
    const input = context.getStepResult('trigger');
    async function generateChangelog(oldVersion: string, newVersion: string) {
      try {
        // Make sure the tags exist
        const tags = execSync('git tag', { encoding: 'utf-8' }).split('\n');

        if (!tags.includes(oldVersion)) {
          console.error(`Error: Tag '${oldVersion}' not found.`);
          process.exit(1);
        }

        if (!tags.includes(newVersion)) {
          console.error(`Error: Tag '${newVersion}' not found.`);
          process.exit(1);
        }

        // Get all commits between the two versions
        const command = `git log ${oldVersion}..${newVersion} --pretty=format:"%s|%h|%an|%ad" --date=short`;
        const commitsRaw = execSync(command, { encoding: 'utf-8' }).split('\n');

        const agent = mastra?.getAgent('commitCategorizer');

        if (!agent) {
          throw new Error('commitCategorizer agent not found');
        }

        // Object to store categorized commits
        const categorizedCommits = {};
        // Object to group commits by area
        const commitsByArea = {};

        console.log(`Processing ${commitsRaw.length} commits...`);

        // Create a temporary file that updates every 5 seconds for monitoring progress
        const interval = setInterval(() => {
          writeFileSync('categorized_commits.json', JSON.stringify(categorizedCommits, null, 2));
        }, 5000);

        for (const commit of commitsRaw) {
          // Skip chore commits
          if (commit.startsWith('chore')) {
            continue;
          }

          // Use the agent to categorize the commit
          const result = await agent.generate(`Classify this commit ${commit}`, {
            output: z.object({
              area: z.string(),
              confidence: z.number(),
              reasoning: z.string(),
              secondary_areas: z.array(z.string()),
              impact_type: z.string(),
            }),
          });

          console.log(result.object);

          // Extract commit details
          const [message, hash, author, date] = commit.split('|');

          // Extract PR number from commit message if available
          const prMatch = message.match(/\(#(\d+)\)/);
          const prNumber = prMatch ? prMatch[1] : null;

          // Create commit object
          const commitObj = {
            commit,
            message,
            hash,
            author,
            date,
            pr_number: prNumber,
            pr_summary: null,
            confidence: result.object.confidence,
            reasoning: result.object.reasoning,
            area: result.object.area,
            secondary_areas: result.object.secondary_areas,
            impact_type: result.object.impact_type,
          };

          // Store categorized commit
          categorizedCommits[hash] = commitObj;

          // Group commits by area
          const area = result.object.area;
          if (!commitsByArea[area]) {
            commitsByArea[area] = {
              commits: [],
              totalConfidence: 0,
              averageConfidence: 0,
            };
          }

          commitsByArea[area].commits.push(categorizedCommits[hash]);
          commitsByArea[area].totalConfidence += result.object.confidence;
        }

        // Calculate average confidence for each area
        for (const area in commitsByArea) {
          const areaData = commitsByArea[area];
          areaData.averageConfidence = areaData.totalConfidence / areaData.commits.length;
        }

        clearInterval(interval);

        // Fetch PR details and generate summaries
        console.log('Fetching PR details and generating summaries...');
        await fetchPRDetailsAndSummarize(commitsByArea, mastra);

        // Filter out docs-related categories
        const filteredCommitsByArea = { ...commitsByArea };
        const docsCategories = ['Docs (content)', 'Docs (dev)', 'Docs content', 'Docs dev'];

        docsCategories.forEach(category => {
          if (filteredCommitsByArea[category]) {
            console.log(`Removing ${filteredCommitsByArea[category].commits.length} commits from ${category} category`);
            delete filteredCommitsByArea[category];
          }
        });

        // Create commits directory if it doesn't exist
        const commitsDir = path.join(process.cwd(), 'commits');
        if (!existsSync(commitsDir)) {
          mkdirSync(commitsDir, { recursive: true });
        }

        // Generate filename with current date
        const today = new Date();
        const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `commits-${dateString}.json`;
        const filePath = path.join(commitsDir, filename);

        // Write filtered categorized commits to file
        writeFileSync(filePath, JSON.stringify(filteredCommitsByArea, null, 2));
        console.log(`Categorized commits (excluding docs) written to ${filePath}`);

        return filteredCommitsByArea;
      } catch (error) {
        console.error('Error generating changelog:', error.message);
        process.exit(1);
      }
    }

    /**
     * PR details interface for GitHub API response
     */
    interface PRDetails {
      title: string;
      body: string | null;
      number: number;
      html_url: string;
      user: {
        login: string;
      };
      created_at: string;
      merged_at: string | null;
    }

    /**
     * Fetches PR details from GitHub and generates summaries for each PR
     * @param commitsByArea - Object containing commits grouped by area
     * @param mastra - Mastra instance for accessing agents
     */
    async function fetchPRDetailsAndSummarize(commitsByArea, mastra) {
      // Get the summarizer agent
      const agent = mastra?.getAgent('summarizer');
      if (!agent) {
        console.warn('Summarizer agent not found, skipping PR summarization');
        return;
      }

      // Iterate through each area and commit
      for (const area in commitsByArea) {
        const areaData = commitsByArea[area];

        for (const commit of areaData.commits) {
          if (!commit.pr_number) continue;

          try {
            // Fetch PR details from GitHub
            const prDetails = await fetchPRDetails(commit.pr_number);

            if (prDetails) {
              // Generate summary using the agent
              const result = await agent.generate(
                `Summarize this PR in one concise sentence:\n\nTitle: ${prDetails.title}\nDescription: ${prDetails.body || 'No description'}`,
                {
                  output: z.object({
                    summary: z.string(),
                  }),
                },
              );

              // Add summary to commit object
              commit.pr_summary = result.object.summary;
              console.log(`Generated summary for PR #${commit.pr_number}`);
            }
          } catch (error) {
            console.error(`Error processing PR #${commit.pr_number}:`, error.message);
          }
        }
      }
    }

    /**
     * Fetches PR details from GitHub API
     * @param prNumber - PR number to fetch
     * @returns PR details object or null if not found
     */
    async function fetchPRDetails(prNumber): Promise<PRDetails | null> {
      return new Promise((resolve, reject) => {
        // You'll need to replace 'your-username/your-repo' with your actual GitHub repo
        // For private repos, you'll need to add authentication
        const options = {
          hostname: 'api.github.com',
          path: `/repos/mastra-ai/mastra/pulls/${prNumber}`,
          method: 'GET',
          headers: {
            'User-Agent': 'Mastra-Changelog-Generator',
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
          },
        };

        const req = https.request(options, res => {
          let data = '';

          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const prDetails = JSON.parse(data) as PRDetails;
                resolve(prDetails);
              } catch (error) {
                reject(new Error(`Failed to parse PR details: ${error.message}`));
              }
            } else if (res.statusCode === 404) {
              console.warn(`PR #${prNumber} not found`);
              resolve(null);
            } else {
              reject(new Error(`Failed to fetch PR #${prNumber}: ${res.statusCode}`));
            }
          });
        });

        req.on('error', error => {
          reject(new Error(`Request error for PR #${prNumber}: ${error.message}`));
        });

        req.end();
      });
    }

    return generateChangelog(input.oldVersion, input.newVersion);
  },
});
