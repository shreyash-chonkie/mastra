import fs from 'fs/promises';
import path from 'path';

export async function setupVitePress(version: string, packages: string[]) {
  const vitepressDir = path.resolve(process.cwd(), 'typedoc/generated');
  const configDir = path.join(vitepressDir, '.vitepress');

  await fs.mkdir(configDir, { recursive: true });

  // Create VitePress config with dark theme and custom styling
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
    ],
    // Theme customization
    siteTitle: 'Mastra'
  },
  // Custom CSS
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
      /* From dark.css */
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
})`;

  await fs.writeFile(path.join(configDir, 'config.ts'), configContent.trim());

  // Create a more comprehensive index page with grid layout
  const indexContent = `---
layout: home
title: Mastra API Documentation
hero:
  name: Mastra
  text: API Documentation
  tagline: Comprehensive API documentation for all Mastra packages
  actions:
    - theme: brand
      text: Get Started
      link: '/${version}/core/README'
    - theme: alt
      text: View on GitHub
      link: https://github.com/mastra-ai/mastra
features:
  ${packages
    .map(
      pkg => `- title: ${pkg}
    details: View the API documentation for ${pkg}
    link: /${version}/${pkg}/README`,
    )
    .join('\n  ')}
---

<style>
.VPFeatures {
  padding: 0 24px;
}
.dark .VPFeature {
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  transition: border-color 0.25s;
}
.dark .VPFeature:hover {
  border-color: var(--vp-c-brand);
}
.custom-layout {
  background-color: var(--vp-c-bg-soft);
  padding: 24px;
  margin: 24px 0;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}
.dark .custom-layout {
  background-color: var(--vp-c-bg-alt);
}
</style>
`;

  await fs.mkdir(path.join(vitepressDir, 'docs'), { recursive: true });
  await fs.writeFile(path.join(vitepressDir, 'docs', 'index.md'), indexContent);
}
