#!/usr/bin/env node

/**
 * Changelog Generator
 *
 * This script generates a changelog between two versions of an npm package
 * by extracting and categorizing git commits.
 *
 * Usage:
 *   node changelog-generator.js <old-version> <new-version>
 *
 * Example:
 *   node changelog-generator.js v1.0.0 v1.1.0
 */

import { execSync } from 'child_process';
import path from 'path';
import { mastra } from './mastra';
import { z } from 'zod';
import { writeFileSync } from 'fs';

async function generateChangelog(oldVersion, newVersion) {
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

    const agent = mastra.getAgent('commitCategorizer');

    const categorizedCommits = {};

    console.log(commitsRaw.length);

    const interval = setInterval(() => {
      writeFileSync('categorized_commits.json', JSON.stringify(categorizedCommits, null, 2));
    }, 5000);

    for (const commit of commitsRaw) {
      if (commit.startsWith('chore')) {
        continue;
      }

      const result = await agent.generate(
        `
        Classify this commit
        ${commit}
        `,
        {
          output: z.object({
            area: z.string(),
            confidence: z.number(),
            reasoning: z.string(),
            secondary_areas: z.array(z.string()),
            impact_type: z.string(),
          }),
        },
      );

      console.log(result.object);

      const [_, hash, __, ___] = commit.split('|');

      categorizedCommits[hash] = {
        commit,
        confidence: result.object.confidence,
        reasoning: result.object.reasoning,
        area: result.object.area,
        secondary_areas: result.object.secondary_areas,
        impact_type: result.object.impact_type,
      };
    }

    clearInterval(interval);

    console.log(categorizedCommits);
  } catch (error) {
    console.error('Error generating changelog:', error.message);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node changelog-generator.js <old-version> <new-version>');
  process.exit(1);
}

const [oldVersion, newVersion] = args;
generateChangelog(oldVersion, newVersion).catch(error => {
  console.error('Error generating changelog:', error.message);
  process.exit(1);
});
