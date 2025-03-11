import { Application } from 'typedoc';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';
import fetch from 'node-fetch';
import semver from 'semver';
import {
  PackageInfo,
  DEPLOYERS,
  INTEGRATIONS,
  CLIENT_SDKS,
  CORE_PACKAGES,
  SPEECH_PACKAGES,
  STORE_PACKAGES,
  VOICE_PACKAGES,
} from './packages.js';
import { DarkTheme } from '../theme/dark-theme.js';
import { generateLandingPage } from './landing-page.js';
import { generatePackageIndex } from './package-index.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocumentationFailure {
  packageName: string;
  version: string;
  reason: string;
}

async function getPackageVersions(packageName: string): Promise<string[]> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const data = await response.json();
    return Object.keys(data.versions)
      .filter(version => semver.valid(version))
      .sort(semver.rcompare);
  } catch (error) {
    console.error(`Failed to fetch versions for ${packageName}:`, error);
    return [];
  }
}

async function downloadPackageVersion(packageName: string, version: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), 'mastra-docs', packageName, version);
  await fs.mkdir(tempDir, { recursive: true });

  execSync(`npm pack ${packageName}@${version}`, { cwd: tempDir });
  const tarball = (await fs.readdir(tempDir)).find(f => f.endsWith('.tgz'));
  if (!tarball) throw new Error(`Could not find downloaded package for ${packageName}@${version}`);

  execSync(`tar -xzf ${tarball}`, { cwd: tempDir });
  return path.join(tempDir, 'package');
}

async function findEntryPoint(packagePath: string): Promise<string[] | null> {
  // Common source directories and entry files
  const possibleSources = ['src', 'lib', 'dist'];
  const possibleEntries = ['index.ts', 'main.ts', 'index.d.ts'];

  // First try to read package.json for types or main field
  try {
    const pkgJson = JSON.parse(await fs.readFile(path.join(packagePath, 'package.json'), 'utf-8'));

    if (pkgJson.types || pkgJson.typings) {
      const typesPath = pkgJson.types || pkgJson.typings;
      if (
        await fs
          .access(path.join(packagePath, typesPath))
          .then(() => true)
          .catch(() => false)
      ) {
        return [typesPath];
      }
    }
  } catch (error) {
    console.warn('Could not read package.json');
  }

  // Try common source directories
  const entryPoints: string[] = [];
  for (const dir of possibleSources) {
    for (const entry of possibleEntries) {
      const entryPath = path.join(dir, entry);
      if (
        await fs
          .access(path.join(packagePath, entryPath))
          .then(() => true)
          .catch(() => false)
      ) {
        entryPoints.push(entryPath);
      }
    }
  }

  // Try root directory
  for (const entry of possibleEntries) {
    if (
      await fs
        .access(path.join(packagePath, entry))
        .then(() => true)
        .catch(() => false)
    ) {
      entryPoints.push(entry);
    }
  }

  return entryPoints.length > 0 ? entryPoints : null;
}

async function createTempTsConfig(packagePath: string, entryPoints: string[]) {
  const tsConfig = {
    compilerOptions: {
      target: 'es2020',
      module: 'commonjs',
      moduleResolution: 'node',
      lib: ['es2020', 'dom'],
      declaration: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      types: ['node', 'react'],
    },
    include: entryPoints,
  };

  const tsConfigPath = path.join(packagePath, 'tsconfig.json');
  await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2));
  return tsConfigPath;
}

async function buildDocsForPackage(packageInfo: PackageInfo): Promise<boolean> {
  const failures: DocumentationFailure[] = [];

  console.log(`\nProcessing ${packageInfo.name} documentation...`);

  // Get all versions for this package
  const versions = await getPackageVersions(packageInfo.name);
  if (versions.length === 0) {
    console.error(`No versions found for ${packageInfo.name}`);
    return false;
  }

  const outputBaseDir = path.resolve(__dirname, '../generated/docs', packageInfo.name);
  await fs.mkdir(outputBaseDir, { recursive: true });

  // Generate docs for each version
  for (const version of versions) {
    const outputPath = path.join(outputBaseDir, version);
    await fs.mkdir(outputPath, { recursive: true });

    try {
      const packagePath = await downloadPackageVersion(packageInfo.name, version);

      // Find all potential entry points
      const entryPoints = await findEntryPoint(packagePath);
      if (!entryPoints) {
        throw new Error(`Could not find entry point for ${packageInfo.name}@${version}`);
      }

      // Create temporary tsconfig that includes all potential entry points
      const tsConfigPath = await createTempTsConfig(packagePath, entryPoints);

      // Install required dependencies
      await execSync('npm install --no-save @types/react @types/node', { cwd: packagePath });

      const app = await Application.bootstrapWithPlugins({
        name: packageInfo.displayName,
        excludePrivate: true,
        excludeProtected: true,
        excludeInternal: true,
        theme: 'dark',
        entryPoints,
        entryPointStrategy: 'resolve',
        tsconfig: tsConfigPath,
        out: outputPath,
        skipErrorChecking: true, // Add this to bypass TS errors
      });

      app.renderer.defineTheme('dark', DarkTheme);

      const project = await app.convert();
      if (project) {
        await app.generateDocs(project, outputPath);
        console.log(`✓ Generated ${packageInfo.name} documentation for version ${version}`);

        // Generate version selector for this package
        await generatePackageIndex(packageInfo, versions, version, outputPath);

        // Cleanup temp directory
        await fs.rm(path.dirname(path.dirname(packagePath)), { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Documentation generation failed for ${packageInfo.name}@${version}:`, error);
      failures.push({
        packageName: packageInfo.name,
        version: version,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // Create package index that redirects to latest version
  await generatePackageIndex(packageInfo, versions, versions[0], outputBaseDir);

  return true;
}

async function writeFailureReport(failures: DocumentationFailure[], outputDir: string) {
  const report = failures.map(f => `Package: ${f.packageName}@${f.version}\nReason: ${f.reason}\n`).join('\n');

  await fs.writeFile(path.join(outputDir, 'documentation-failures.txt'), report);
}

async function buildCategoryDocs(packages: PackageInfo[], categoryName: string, failures: DocumentationFailure[]) {
  console.log(`\nBuilding documentation for ${categoryName}...`);
  const results = await Promise.all(packages.map(pkg => buildDocsForPackage(pkg)));
  const successful = results.filter(Boolean).length;
  console.log(`Completed ${categoryName} documentation (${successful}/${packages.length} packages)`);
}

// Main execution
(async () => {
  const failures: DocumentationFailure[] = [];

  try {
    const outputDir = path.resolve(__dirname, '../generated');
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });

    // Build docs for each category
    await buildCategoryDocs(CORE_PACKAGES, 'Core Packages', failures);
    await buildCategoryDocs(CLIENT_SDKS, 'Client SDKs', failures);
    await buildCategoryDocs(DEPLOYERS, 'Deployers', failures);
    await buildCategoryDocs(INTEGRATIONS, 'Integrations', failures);
    await buildCategoryDocs(SPEECH_PACKAGES, 'Speech Packages', failures);
    await buildCategoryDocs(STORE_PACKAGES, 'Store Packages', failures);
    await buildCategoryDocs(VOICE_PACKAGES, 'Voice Packages', failures);

    // Generate landing page
    await generateLandingPage();

    // Write failure report if there were any failures
    if (failures.length > 0) {
      await writeFailureReport(failures, outputDir);
      console.log(
        `\n${failures.length} packages failed documentation generation. See documentation-failures.txt for details.`,
      );
    }

    console.log('\nDocumentation generation complete!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
