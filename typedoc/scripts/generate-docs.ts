import { Application } from 'typedoc';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { generateSidebar } from './utils/generateSidebar.js';
import { setupVitePress } from './utils/setupVitePress.js';
import {
  PackageInfo,
  DEPLOYERS,
  INTEGRATIONS,
  CLIENT_SDKS,
  CORE_PACKAGES,
  SPEECH_PACKAGES,
  STORE_PACKAGES,
  VOICE_PACKAGES,
  ALL_PACKAGES,
} from './packages.js';
import { DarkTheme } from '../theme/dark-theme.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getGitVersions() {
  // Get all git tags
  const tags = execSync('git tag --sort=-v:refname').toString().trim().split('\n');

  // Create versions.json
  const versions = {
    latest: tags[0],
    versions: tags.reduce(
      (acc, tag) => ({
        ...acc,
        [tag]: tag === tags[0] ? 'stable' : 'legacy',
      }),
      {},
    ),
  };

  await fs.writeFile(path.resolve(__dirname, '../versions.json'), JSON.stringify(versions, null, 2));

  return tags;
}

async function buildDocsForVersion(packageInfo: PackageInfo, version: string) {
  console.log(`\nProcessing ${packageInfo.name} documentation for version ${version}...`);

  // Checkout specific version
  // execSync(`git checkout ${version}`);

  const outputPath = path.resolve(__dirname, '../generated/docs', version, packageInfo.name);
  const packagePath = path.join(process.cwd(), packageInfo.path);

  await fs.mkdir(outputPath, { recursive: true });

  const app = await Application.bootstrapWithPlugins({
    name: packageInfo.displayName,
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
    // theme: 'dark',
    entryPoints: [path.join(packagePath, 'src/index.ts')],
    entryPointStrategy: 'resolve',
    tsconfig: path.join(packagePath, 'tsconfig.json'),
    out: outputPath,
    plugin: ['typedoc-plugin-markdown'],
    theme: 'markdown',
    readme: 'none',
    skipErrorChecking: true,
  });

  // // Register our dark theme
  // app.renderer.defineTheme('dark', DarkTheme);

  try {
    const project = await app.convert();
    if (project) {
      await app.generateDocs(project, outputPath);
      console.log(`✓ Generated ${packageInfo.name} documentation for version ${version}`);
      return true;
    }
    console.error(`✗ Failed to generate ${packageInfo.name} documentation for version ${version}`);
    return false;
  } catch (error) {
    console.error(`Documentation generation failed for ${packageInfo.name}:`, error);
    return false;
  }
}

async function buildCategoryDocs(packages: PackageInfo[], categoryName: string, version: string) {
  console.log(`\nBuilding documentation for ${categoryName}...`);
  const results = await Promise.all(packages.map(pkg => buildDocsForVersion(pkg, version)));
  const successful = results.filter(Boolean).length;
  console.log(`Completed ${categoryName} documentation (${successful}/${packages.length} packages)`);
}

// Main execution
(async () => {
  try {
    await fs.rm(path.resolve(__dirname, '../generated'), { recursive: true, force: true }).catch(() => {});

    // Store current branch
    // const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

    // Get all versions
    // const versions = await getGitVersions();
    // console.log(versions);
    const versions = ['v1.0.0'];

    const sidebar = {} as Record<string, any>;

    // Generate docs for each version
    for (const version of versions) {
      console.log(`\nGenerating documentation for version ${version}`);

      // Build all categories sequentially for this version
      await buildCategoryDocs(DEPLOYERS, 'Deployers', version);
      await buildCategoryDocs(INTEGRATIONS, 'Integrations', version);
      await buildCategoryDocs(CLIENT_SDKS, 'Client SDKs', version);
      await buildCategoryDocs(CORE_PACKAGES, 'Core Packages', version);
      await buildCategoryDocs(SPEECH_PACKAGES, 'Speech Packages', version);
      await buildCategoryDocs(STORE_PACKAGES, 'Store Packages', version);
      await buildCategoryDocs(VOICE_PACKAGES, 'Voice Packages', version);

      // Generate sidebar for all packages after docs are generated
      for (const pkg of ALL_PACKAGES) {
        const docsPath = path.resolve(__dirname, '../generated/docs', version, pkg.name);
        const sidebarItems = await generateSidebar(docsPath, `${version}/${pkg.name}`);
        const sideBarKey = `/${version}/${pkg.name}`;
        sidebar[sideBarKey] = sidebarItems;
      }

      // Write the complete sidebar configuration
      const sidebarPath = path.resolve(__dirname, '../generated/sidebar.json');
      await fs.writeFile(sidebarPath, JSON.stringify(sidebar, null, 2));

      // Setup VitePress with all packages
      const packageNames = ALL_PACKAGES.map(pkg => pkg.name);
      await setupVitePress(version, packageNames);
    }

    // Return to original branch
    // execSync(`git checkout ${currentBranch}`);

    // // Generate the landing page
    // await generateLandingPage();

    console.log('\nAll documentation generated successfully!');
    console.log('\nTo preview the documentation, run:');
    console.log('pnpm docs:dev');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
