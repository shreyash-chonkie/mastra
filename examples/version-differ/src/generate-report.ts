import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { mastra } from './mastra';
import { z } from 'zod';
import path from 'path';

type CommitInfo = {
  commit: string;
  message: string;
  hash: string;
  author: string;
  date: string;
  pr_number: string | null;
  pr_summary: string | null;
  confidence: number;
  reasoning: string;
  area: string;
  secondary_areas: string[];
  impact_type: string;
};

type CategorizedCommits = Record<string, CommitInfo>;

function filterCommits(commits: CategorizedCommits, areasToFilter: string[]): CategorizedCommits {
  return Object.entries(commits).reduce((filtered, [hash, commit]) => {
    // Skip if primary area is in filter list
    if (areasToFilter.includes(commit.area)) {
      return filtered;
    }

    // Skip if any filtered area is in secondary areas
    if (commit.secondary_areas.some(area => areasToFilter.includes(area))) {
      return filtered;
    }

    filtered[hash] = commit;
    return filtered;
  }, {} as CategorizedCommits);
}

type GroupedCommits = {
  [area: string]: {
    commits: CommitInfo[];
    totalConfidence: number;
    averageConfidence: number;
  };
};

function groupByArea(commits: CategorizedCommits): GroupedCommits {
  return Object.entries(commits).reduce((grouped, [hash, commit]) => {
    const area = commit.area;

    if (!grouped[area]) {
      grouped[area] = {
        commits: [],
        totalConfidence: 0,
        averageConfidence: 0,
      };
    }

    grouped[area].commits.push(commit);
    grouped[area].totalConfidence += commit.confidence;
    grouped[area].averageConfidence = grouped[area].totalConfidence / grouped[area].commits.length;

    return grouped;
  }, {} as GroupedCommits);
}

async function generate() {
  // Find the most recent commits JSON file
  const commitsDir = path.join(process.cwd(), 'commits');
  if (!existsSync(commitsDir)) {
    console.error('Commits directory not found. Please run the commit categorization first.');
    process.exit(1);
  }

  // Get the most recent commits file
  const files = readdirSync(commitsDir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('No commit files found. Please run the commit categorization first.');
    process.exit(1);
  }

  const latestFile = path.join(commitsDir, files[0]);
  console.log(`Using latest commits file: ${latestFile}`);

  // Read and parse the commits file
  const groupedCommits = JSON.parse(readFileSync(latestFile, 'utf-8')) as GroupedCommits;

  // Generate the release report
  const today = new Date();
  const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

  let markdownContent = `# Mastra Release - ${dateString}\n\n`;
  markdownContent += `Today we release a new latest version of Mastra.\n\n`;

  // Add sections for each area with commits
  Object.keys(groupedCommits)
    .sort()
    .forEach(area => {
      if (groupedCommits[area].commits.length === 0) return;

      markdownContent += `## ${area}\n\n`;

      // Add each commit as a bullet point with PR link if available
      groupedCommits[area].commits.forEach(commit => {
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
          description = description.replace(/\(#\d+\)/g, '').trim();
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

  // Optionally, also generate summaries using the agent
  const agent = mastra.getAgent('summarizer');
  if (agent) {
    console.log('\nGenerating area summaries:');
    for (const [area, entry] of Object.entries(groupedCommits)) {
      console.log(`\n${area} (${entry.averageConfidence.toFixed(2)})`);

      try {
        const result = await agent.generate(
          `Summarize the following commits for the ${area} area in 1-2 sentences:\n${JSON.stringify(entry.commits.map(c => c.message))}`,
          {
            output: z.object({
              summary: z.string(),
            }),
          },
        );

        console.log(result.object.summary);
      } catch (error) {
        console.error(`Error generating summary for ${area}:`, error.message);
      }
    }
  }
}

generate();
