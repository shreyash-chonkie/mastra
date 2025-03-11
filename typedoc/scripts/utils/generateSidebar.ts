import fs from 'fs/promises';
import path from 'path';

export async function generateSidebar(docsDir: string, version: string) {
  const files = await fs.readdir(docsDir);
  console.log('Generated files:', files);

  const sidebarItems = [] as any[];

  // Add README if it exists
  if (files.includes('README.md')) {
    sidebarItems.push({
      text: 'Introduction',
      link: `/${version}/README`,
    });
  }

  // Process each directory
  for (const file of files) {
    if ((await fs.stat(path.join(docsDir, file))).isDirectory()) {
      const dirFiles = await fs.readdir(path.join(docsDir, file));
      const items = [];

      for (const dirFile of dirFiles) {
        if (dirFile.endsWith('.md')) {
          const name = dirFile.replace('.md', '');
          items.push({
            text: name,
            link: `/${version}/${file}/${name}`,
          });
        }
      }

      if (items.length > 0) {
        sidebarItems.push({
          text: file.charAt(0).toUpperCase() + file.slice(1),
          collapsed: false,
          items,
        });
      }
    }
  }

  return sidebarItems;
}
