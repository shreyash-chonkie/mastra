import path from 'path';
import fs from 'fs/promises';
import { PackageInfo } from './packages.js';

export async function generatePackageIndex(
  packageInfo: PackageInfo,
  versions: string[],
  currentVersion: string,
  outputDir: string,
) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${packageInfo.displayName} Documentation</title>
    <style>
        :root {
            --color-background: #0a0a0a;
            --color-text: #e4e4e4;
            --color-text-aside: #a3a3a3;
            --color-link: #ffffff;
            --color-menu-divider: #2d2d2d;
            --color-background-secondary: #141415;
            --color-card-border: #2d2d2d;
        }
        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            background: var(--color-background);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .version-select {
            position: fixed;
            top: 1rem;
            right: 1rem;
            z-index: 1000;
        }
        select {
            appearance: none;
            background: var(--color-background-secondary);
            color: var(--color-text);
            border: 1px solid var(--color-card-border);
            border-radius: 0.375rem;
            padding: 0.5rem 2.5rem 0.5rem 1rem;
            font-size: 14px;
            cursor: pointer;
            min-width: 150px;
        }
        select:hover {
            border-color: var(--color-link);
        }
        .version-select::after {
            content: "▼";
            position: absolute;
            right: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--color-text);
            pointer-events: none;
            font-size: 0.8em;
        }
        iframe {
            width: 100%;
            height: 100vh;
            border: none;
        }
    </style>
    <script>
        function changeVersion(select) {
            const currentPath = window.location.pathname;
            const newPath = currentPath.replace(/${currentVersion}/, select.value);
            window.location.href = newPath;
        }
    </script>
</head>
<body>
    <div class="version-select">
        <select onChange="changeVersion(this)">
            ${versions
              .map(
                v => `
                <option value="${v}" ${v === currentVersion ? 'selected' : ''}>
                    ${v}
                </option>
            `,
              )
              .join('')}
        </select>
    </div>
    <iframe src="index.html"></iframe>
</body>
</html>
  `;

  await fs.writeFile(path.join(outputDir, 'wrapper.html'), html);
}
