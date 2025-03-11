import { Octokit } from '@octokit/rest';
import path from 'path';
import semver from 'semver';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_INFO = {
  owner: 'your-org',
  repo: 'your-repo',
};

export async function getPackageVersions(packageName: string): Promise<string[]> {
  try {
    const { data: tags } = await octokit.repos.listTags({
      ...REPO_INFO,
      per_page: 100,
    });

    // Filter tags that match the package pattern
    // e.g., "@mastra/core@1.0.0" or "core@1.0.0"
    const packageTags = tags
      .map(tag => tag.name)
      .filter(tag => {
        const packagePattern = packageName.startsWith('@')
          ? packageName.replace('/', '\\/') // Handle scoped packages
          : packageName;
        const tagRegex = new RegExp(`^${packagePattern}@\\d+\\.\\d+\\.\\d+`);
        return tagRegex.test(tag);
      })
      .map(tag => tag.split('@')[1]); // Extract version number

    return packageTags.sort((a, b) => semver.rcompare(a, b));
  } catch (error) {
    console.error(`Failed to fetch versions for ${packageName}:`, error);
    return [];
  }
}

export async function getPackageFiles(
  packagePath: string,
  version: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const ref = `${packagePath}@${version}`;

    // First get the tsconfig
    try {
      const { data: tsconfig } = await octokit.repos.getContent({
        ...REPO_INFO,
        path: path.join(packagePath, 'tsconfig.json'),
        ref,
      });

      if ('content' in tsconfig) {
        return [
          {
            path: 'tsconfig.json',
            content: Buffer.from(tsconfig.content, 'base64').toString('utf-8'),
          },
        ];
      }
    } catch (error) {
      console.warn(`No tsconfig.json found in ${packagePath} at ${version}`);
    }

    // Then get all TypeScript files
    const { data: contents } = await octokit.repos.getContent({
      ...REPO_INFO,
      path: packagePath,
      ref,
    });

    if (!Array.isArray(contents)) {
      throw new Error(`${packagePath} is not a directory`);
    }

    const files = await Promise.all(
      contents
        .filter(file => file.name.endsWith('.ts') || file.name.endsWith('.tsx'))
        .map(async file => {
          const { data } = await octokit.repos.getContent({
            ...REPO_INFO,
            path: file.path,
            ref,
          });

          if ('content' in data) {
            return {
              path: file.path,
              content: Buffer.from(data.content, 'base64').toString('utf-8'),
            };
          }
          return null;
        }),
    );

    return files.filter((f): f is { path: string; content: string } => f !== null);
  } catch (error) {
    console.error(`Failed to fetch files for ${packagePath}@${version}:`, error);
    throw error;
  }
}
