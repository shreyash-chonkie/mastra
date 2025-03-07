import { Application, TypeDocOptions } from 'typedoc';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
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

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildDocs(packageInfo: PackageInfo) {
  console.log(`\nProcessing ${packageInfo.name} documentation...`);

  const projectRoot = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(__dirname, '..', 'generated', 'packages', packageInfo.name);
  const packagePath = path.join(projectRoot, packageInfo.path);

  await fs.rm(outputPath, { recursive: true, force: true }).catch(() => {});

  const options: Partial<TypeDocOptions> = {
    name: packageInfo.displayName,
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
    theme: 'default',
    entryPoints: [path.join(packagePath, 'src/index.ts')],
    entryPointStrategy: 'resolve',
    tsconfig: path.join(packagePath, 'tsconfig.json'),
    out: outputPath,
  };

  const app = await Application.bootstrap(options);

  try {
    const project = await app.convert();
    if (project) {
      await app.generateDocs(project, app.options.getValue('out'));
      console.log(`✓ Generated ${packageInfo.name} documentation`);
      return true;
    } else {
      console.error(`✗ Failed to generate ${packageInfo.name} documentation`);
      return false;
    }
  } catch (error) {
    console.error(`Documentation generation failed for ${packageInfo.name}:`, error);
    return false;
  }
}

async function buildCategoryDocs(packages: PackageInfo[], category: string) {
  console.log(`\nBuilding documentation for ${category}...`);
  const results = await Promise.all(packages.map(pkg => buildDocs(pkg)));
  const successful = results.filter(Boolean).length;
  console.log(`Completed ${category} documentation (${successful}/${packages.length} packages)`);
  return results;
}

async function generateLandingPage() {
  const categories = [
    { name: 'Deployers', packages: DEPLOYERS },
    { name: 'Integrations', packages: INTEGRATIONS },
    { name: 'Client SDKs', packages: CLIENT_SDKS },
    { name: 'Core Packages', packages: CORE_PACKAGES },
    { name: 'Speech Packages', packages: SPEECH_PACKAGES },
    { name: 'Store Packages', packages: STORE_PACKAGES },
    { name: 'Voice Packages', packages: VOICE_PACKAGES },
  ];

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Mastra Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        h1 { color: #2c3e50; }
        h2 { 
            color: #34495e;
            border-bottom: 2px solid #eee;
            padding-bottom: 0.5rem;
        }
        .category {
            margin-bottom: 2rem;
        }
        .packages {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        .package-card {
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 1rem;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .package-card h3 {
            margin: 0 0 0.5rem 0;
            color: #2c3e50;
        }
        .package-card p {
            margin: 0;
            color: #666;
            font-size: 0.9rem;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h1>Mastra Documentation</h1>
    ${categories
      .map(
        category => `
        <div class="category">
            <h2>${category.name}</h2>
            <div class="packages">
                ${category.packages
                  .map(
                    pkg => `
                    <div class="package-card">
                        <h3><a href="packages/${pkg.name}/index.html">${pkg.displayName}</a></h3>
                        <p>${pkg.path}</p>
                    </div>
                `,
                  )
                  .join('')}
            </div>
        </div>
    `,
      )
      .join('')}
</body>
</html>
  `;

  const outputPath = path.resolve(__dirname, '..', 'generated', 'index.html');
  await fs.writeFile(outputPath, html);
  console.log('✓ Generated landing page');
}

// Main execution
(async () => {
  try {
    // Create generated directory if it doesn't exist
    const generatedDir = path.resolve(__dirname, '..', 'generated');
    await fs.mkdir(generatedDir, { recursive: true });

    // Build individual package docs
    await buildCategoryDocs(DEPLOYERS, 'Deployers');
    await buildCategoryDocs(INTEGRATIONS, 'Integrations');
    await buildCategoryDocs(CLIENT_SDKS, 'Client SDKs');
    await buildCategoryDocs(CORE_PACKAGES, 'Core Packages');
    await buildCategoryDocs(SPEECH_PACKAGES, 'Speech Packages');
    await buildCategoryDocs(STORE_PACKAGES, 'Store Packages');
    await buildCategoryDocs(VOICE_PACKAGES, 'Voice Packages');

    // Generate the landing page
    await generateLandingPage();

    console.log('\nAll documentation generated successfully!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
