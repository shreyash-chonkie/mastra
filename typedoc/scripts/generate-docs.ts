import { Application } from 'typedoc';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
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
import { getPackageVersions, getPackageFiles } from './get-versions.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocumentationFailure {
  packageName: string;
  version: string;
  reason: string;
}

async function buildDocsForPackage(packageInfo: PackageInfo): Promise<boolean> {
  const versions = await getPackageVersions(packageInfo.name);
  if (versions.length === 0) {
    console.warn(`No versions found for ${packageInfo.name}`);
    return false;
  }

  let success = true;
  const outputBaseDir = path.resolve(__dirname, '../generated/docs', packageInfo.name);
  await fs.mkdir(outputBaseDir, { recursive: true });

  for (const version of versions) {
    const tempDir = path.join(process.cwd(), '.temp-docs', packageInfo.name, version);
    const outputDir = path.join(outputBaseDir, version);

    try {
      await fs.mkdir(tempDir, { recursive: true });
      const files = await getPackageFiles(packageInfo.path, version);

      // Write all files to temp directory maintaining their paths
      await Promise.all(
        files.map(async file => {
          const filePath = path.join(tempDir, file.path);
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, file.content);
        }),
      );

      // Use bootstrapWithPlugins with additional options
      const app = await Application.bootstrapWithPlugins({
        name: packageInfo.displayName,
        entryPoints: files.filter(f => f.path !== 'tsconfig.json').map(f => path.join(tempDir, f.path)),
        tsconfig: path.join(tempDir, 'tsconfig.json'),
        out: outputDir,
        skipErrorChecking: true,
        theme: 'dark',
        plugin: ['typedoc-plugin-markdown'],
        excludePrivate: true,
        excludeProtected: true,
        excludeInternal: true,
        excludeExternals: true,
        entryPointStrategy: 'resolve',
      });

      app.renderer.defineTheme('dark', DarkTheme);

      const project = await app.convert();
      if (!project) {
        success = false;
        continue;
      }

      await app.generateDocs(project, outputDir);
      console.log(`✓ Generated ${packageInfo.name} documentation for version ${version}`);

      // Generate version selector for this package
      await generatePackageIndex(packageInfo, versions, version, outputDir);
    } catch (error) {
      console.error(`Documentation generation failed for ${packageInfo.name}@${version}:`, error);
      success = false;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // Create package index that redirects to latest version
  await generatePackageIndex(packageInfo, versions, versions[0], outputBaseDir);

  return success;
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
    const outputDir = path.resolve(__dirname, '../generated/docs');
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

    // Generate landing page and package index
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
