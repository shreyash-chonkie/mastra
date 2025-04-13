import fs from 'node:fs/promises';
import path from 'node:path';
import { log, fromPackageRoot } from '../utils.js';
import { prepareCodeExamples } from './code-examples.js';
import { copyRaw } from './copy-raw.js';
import { preparePackageChanges } from './package-changes.js';

async function prepareCourseSchema() {
  log('Preparing course schema...');
  
  // Define paths
  const courseDir = fromPackageRoot('.docs/raw/course');
  const outputFile = fromPackageRoot('.docs/course/courseSchema.json');
  
  try {
    // Ensure the output directory exists
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    
    // Read all lesson directories
    const lessonDirs = await fs.readdir(courseDir);
    
    // Filter out non-directories and hidden files
    const validLessonDirs = await Promise.all(
      lessonDirs
        .filter(dir => !dir.startsWith('.'))
        .map(async (dir) => {
          const fullPath = path.join(courseDir, dir);
          const stats = await fs.stat(fullPath);
          return stats.isDirectory() ? dir : null;
        })
    );
    
    // Filter out null values and cast to string array
    const filteredLessonDirs = validLessonDirs.filter((dir): dir is string => dir !== null);
    
    // Sort lesson directories by their numeric prefix
    filteredLessonDirs.sort((a, b) => {
      const aMatch = a.match(/^(\d+)/);
      const bMatch = b.match(/^(\d+)/);
      const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
      const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
      return aNum - bNum;
    });
    
    // Build the course schema
    const lessons = await Promise.all(
      filteredLessonDirs.map(async (lessonDir) => {
        const lessonPath = path.join(courseDir, lessonDir);
        
        // Extract lesson name (remove numbering prefix)
        const lessonName = lessonDir.replace(/^\d+-/, '');
        
        // Get all markdown files in the lesson directory
        const stepFiles = (await fs.readdir(lessonPath))
          .filter(file => file.endsWith('.md'))
          .sort((a, b) => {
            const aMatch = a.match(/^(\d+)/);
            const bMatch = b.match(/^(\d+)/);
            const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
            const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
            return aNum - bNum;
          });
        
        // Build steps array
        const steps = await Promise.all(
          stepFiles.map(async (stepFile) => {
            const stepPath = path.join(lessonPath, stepFile);
            const content = await fs.readFile(stepPath, 'utf-8');
            
            // Extract step name (remove numbering prefix and extension)
            const stepName = stepFile.replace(/^\d+-/, '').replace('.md', '');
            
            // Extract description from the first heading in the markdown
            const descriptionMatch = content.match(/^#\s+(.+)$/m);
            const description = descriptionMatch ? descriptionMatch[1] : stepName;
            
            return {
              name: stepName,
              description,
              status: 0, // Default: not started
            };
          })
        );
        
        return {
          name: lessonName,
          description: lessonName, // Default description is the name
          status: 0, // Default: not started
          steps,
        };
      })
    );
    
    // Create the course state structure
    const courseSchema = {
      currentLesson: lessons.length > 0 ? lessons[0].name : '',
      lessons,
    };
    
    // Write the schema to the output file
    await fs.writeFile(outputFile, JSON.stringify(courseSchema, null, 2), 'utf-8');
    
    log(`Course schema created with ${lessons.length} lessons`);
  } catch (error) {
    console.error('Error preparing course schema:', error);
  }
}

export async function prepare() {
  log('Preparing documentation...');
  await copyRaw();
  log('Preparing code examples...');
  await prepareCodeExamples();
  log('Preparing package changelogs...');
  await preparePackageChanges();
  log('Preparing course schema...');
  await prepareCourseSchema();
  log('Documentation preparation complete!');
}

if (process.env.PREPARE === `true`) {
  try {
    await prepare();
  } catch (error) {
    console.error('Error preparing documentation:', error);
    process.exit(1);
  }
}
