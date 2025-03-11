import fs from 'fs/promises';
import path from 'path';

export async function setupVitePress(version: string, packages: string[]) {
  const vitepressDir = path.resolve(process.cwd(), 'typedoc/generated');
  const configDir = path.join(vitepressDir, '.vitepress');

  await fs.mkdir(configDir, { recursive: true });

  // Create VitePress config with dynamic package navigation
  const configContent = `
import { defineConfig } from 'vitepress'
import sidebar from '../sidebar.json'

export default defineConfig({
  title: 'Mastra API Documentation',
  description: 'API documentation for Mastra',
  base: '/',
  themeConfig: {
    sidebar,
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Packages',
        items: [
          ${packages.map(pkg => `{ text: '${pkg}', link: '/${version}/${pkg}/README' }`).join(',\n          ')}
        ]
      }
    ]
  },
  srcDir: 'docs',
  outDir: '.vitepress/dist'
})`;

  await fs.writeFile(path.join(configDir, 'config.ts'), configContent.trim());

  // Create a more comprehensive index page
  const indexContent = `---
layout: home
title: Mastra API Documentation
hero:
  name: Mastra
  text: API Documentation
  tagline: Comprehensive API documentation for all Mastra packages
features:
  ${packages
    .map(
      pkg => `- title: ${pkg}
    details: View the API documentation for ${pkg}
    link: /${version}/${pkg}/README`,
    )
    .join('\n  ')}
---

# Mastra Packages

Mastra is divided into several packages, each serving a specific purpose:

${packages.map(pkg => `- [${pkg}](/${version}/${pkg}/README)`).join('\n')}
`;

  await fs.mkdir(path.join(vitepressDir, 'docs'), { recursive: true });
  await fs.writeFile(path.join(vitepressDir, 'docs', 'index.md'), indexContent);
}
