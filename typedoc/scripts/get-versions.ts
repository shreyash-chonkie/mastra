import fetch from 'node-fetch';
import semver from 'semver';
import { ALL_PACKAGES } from './packages.js';

async function getPackageVersions(packageName: string): Promise<string[]> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const data = await response.json();
    return Object.keys(data.versions)
      .filter(version => semver.valid(version)) // Filter out invalid versions
      .sort(semver.rcompare); // Sort in descending order
  } catch (error) {
    console.error(`Failed to fetch versions for ${packageName}:`, error);
    return [];
  }
}

export async function getAllVersions() {
  // Get all unique packages
  const allPackages = ALL_PACKAGES;

  // Get versions for each package
  const versionsMap = new Map<string, string[]>();
  for (const pkg of allPackages) {
    const versions = await getPackageVersions(pkg.name);
    versionsMap.set(pkg.name, versions);
  }

  // Find common versions across all packages
  const commonVersions = Array.from(versionsMap.values()).reduce(
    (common, versions) => {
      return common.filter(v => versions.includes(v));
    },
    versionsMap.get(allPackages[0].name) || [],
  );

  return commonVersions;
}
