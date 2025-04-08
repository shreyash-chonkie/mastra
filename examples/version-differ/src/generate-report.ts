import { readFileSync, writeFileSync } from 'fs';
import { mastra } from './mastra';
import { z } from 'zod';

type CommitInfo = {
  commit: string;
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
  const categorizedCommits = JSON.parse(readFileSync('categorized_commits.json', 'utf-8')) as CategorizedCommits;

  // Filter out website and examples commits
  const filteredCommits = filterCommits(categorizedCommits, ['Website', 'Docs (content)', 'Examples']);

  // Group by area
  const groupedCommits = groupByArea(filteredCommits);

  console.log(JSON.stringify(groupedCommits, null, 2));

  const groupEntries = Object.entries(groupedCommits);

  const agent = mastra.getAgent('summarizer');

  for (const [area, entry] of groupEntries) {
    console.log(`\n${area} (${entry.averageConfidence.toFixed(2)})`);

    const result = await agent.generate(
      `
            ${JSON.stringify(entry.commits)}
        `,
      {
        output: z.object({
          summary: z.string(),
        }),
      },
    );

    console.log(result.object.summary);
  }
}

generate();
