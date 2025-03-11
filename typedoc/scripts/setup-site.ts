import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupVitePress } from '../utils/setupVitePress.js';
import { generateSidebar } from '../utils/generateSidebar.js';
import { ALL_PACKAGES } from './packages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  try {
    // Clean and create site directory
    const siteDir = path.resolve(__dirname, '../site');
    await fs.rm(siteDir, { recursive: true, force: true });
    await fs.mkdir(siteDir, { recursive: true });

    // Copy over generated docs
    const docsDir = path.resolve(__dirname, '../generated/docs');
    const siteDocsDir = path.join(siteDir, 'docs');
    await fs.cp(docsDir, siteDocsDir, { recursive: true });

    // Generate sidebars for each version
    const versions = ['v1.0.0', 'v0.9.0', 'v0.8.0'];
    const sidebars: Record<string, any> = {};

    for (const version of versions) {
      const versionDir = path.join(siteDocsDir, version);
      const sidebar = await generateSidebar(versionDir, version);
      sidebars[version] = sidebar;
    }

    // Setup VitePress
    await setupVitePress(
      versions[0],
      ALL_PACKAGES.map(pkg => pkg.name),
      versions,
      siteDir,
      sidebars,
    );

    console.log('\nSite setup complete!');
    console.log('\nTo preview the documentation, run:');
    console.log('pnpm docs:dev');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
