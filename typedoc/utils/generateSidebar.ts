import fs from 'fs/promises';
import path from 'path';

export async function generateSidebar(docsDir: string, version: string) {
  const sidebarConfig: Record<string, any> = {};

  // Process each package directory
  const packageDirs = await fs.readdir(docsDir);
  for (const pkgDir of packageDirs) {
    const pkgPath = path.join(docsDir, pkgDir);

    if ((await fs.stat(pkgPath)).isDirectory()) {
      const items = [];

      // Add README if it exists
      if (
        await fs
          .access(path.join(pkgPath, 'README.md'))
          .then(() => true)
          .catch(() => false)
      ) {
        items.push({
          text: 'Overview',
          link: `/${version}/${pkgDir}/README`,
        });
      }

      // Check for different documentation sections
      const sections = ['classes', 'interfaces', 'variables', 'functions', 'types'];
      for (const section of sections) {
        const sectionPath = path.join(pkgPath, section);
        try {
          const sectionFiles = await fs.readdir(sectionPath);
          if (sectionFiles.length > 0) {
            const sectionItems = sectionFiles
              .filter(file => file.endsWith('.md'))
              .map(file => ({
                text: file.replace('.md', ''),
                link: `/${version}/${pkgDir}/${section}/${file.replace('.md', '')}`,
              }));

            if (sectionItems.length > 0) {
              items.push({
                text: section.charAt(0).toUpperCase() + section.slice(1),
                collapsed: false,
                items: sectionItems,
              });
            }
          }
        } catch (error) {
          // Section directory doesn't exist, skip it
        }
      }

      if (items.length > 0) {
        sidebarConfig[`/${version}/${pkgDir}/`] = items;
      }
    }
  }

  return sidebarConfig;
}
