import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupVitePress(
  version: string,
  packages: string[],
  versions: string[],
  siteDir: string,
  sidebars: Record<string, any>,
) {
  const configDir = path.join(siteDir, '.vitepress');
  const docsDir = path.join(siteDir, 'docs');

  await fs.mkdir(configDir, { recursive: true });
  await fs.mkdir(docsDir, { recursive: true });

  // Read template files
  const indexTemplate = await fs.readFile(path.join(__dirname, '../templates/index.md'), 'utf-8');

  // Format sidebars for VitePress
  const formattedSidebars: Record<string, any> = {};
  for (const [version, versionSidebars] of Object.entries(sidebars)) {
    for (const [pkgPath, items] of Object.entries(versionSidebars)) {
      formattedSidebars[pkgPath] = items;
    }
  }

  const configContent = `
    import { defineConfig } from 'vitepress'
    import type { DefaultTheme } from 'vitepress/theme'

    export default defineConfig({
      title: 'Mastra API Documentation',
      description: 'API documentation for Mastra',
      base: '/',
      themeConfig: {
        sidebar: ${JSON.stringify(formattedSidebars, null, 2)},
        nav: [
          { text: 'Home', link: '/' },
          {
            text: 'Packages',
            items: [
              ${packages.map(pkg => `{ text: '${pkg}', link: '/${version}/${pkg}/README' }`).join(',\n              ')}
            ]
          },
          {
            text: '${version}',
            items: [
              ${versions.map(v => `{ text: '${v}', link: '/${v}/' }`).join(',\n              ')}
            ]
          }
        ] as DefaultTheme.NavItem[],
        siteTitle: 'Mastra'
      },
      head: [
        ['style', {}, \`
          .dark {
            --vp-c-bg: #0d0d0d;
            --vp-c-bg-alt: #161618;
            --vp-c-bg-soft: #202127;
            --vp-c-text: #ffffff;
            --vp-c-brand: #ffffff;
            --vp-c-brand-light: #ffffff;
            --vp-button-brand-bg: #2a2a2a;
            --vp-button-brand-hover-bg: #363636;
          }
          .dark .VPFeature {
            background-color: #161618 !important;
            border: 1px solid #2a2a2a !important;
            border-radius: 8px !important;
          }
          .dark .VPFeature:hover {
            border-color: #ffffff !important;
          }
          .dark .vp-doc a {
            color: #ffffff;
          }
          .dark .vp-doc tr:nth-child(2n) {
            background-color: var(--vp-c-bg-soft);
          }
          .dark .vp-doc th, .dark .vp-doc td {
            border-color: var(--vp-c-divider);
          }
          .dark .vp-doc div[class*='language-'] {
            background-color: var(--vp-c-bg-alt);
          }
          .dark .vp-doc code {
            background-color: var(--vp-c-bg-soft);
          }
        \`]
      ],
      srcDir: 'docs',
      outDir: '.vitepress/dist'
    })
  `;

  // Write config
  await fs.writeFile(path.join(configDir, 'config.ts'), configContent);

  // Create version-specific features for index pages
  for (const ver of versions) {
    const features = packages
      .map(
        pkg => `- title: ${pkg}\n    details: View the API documentation for ${pkg}\n    link: /${ver}/${pkg}/README`,
      )
      .join('\n  ');

    const versionDir = path.join(docsDir, ver);
    await fs.mkdir(versionDir, { recursive: true });

    const versionIndexContent = indexTemplate.replace('#{features}', features).replace(/#{version}/g, ver);
    await fs.writeFile(path.join(versionDir, 'index.md'), versionIndexContent);

    // If this is the latest version, also create the root index
    if (ver === versions[0]) {
      await fs.writeFile(path.join(docsDir, 'index.md'), versionIndexContent);
    }
  }
}
