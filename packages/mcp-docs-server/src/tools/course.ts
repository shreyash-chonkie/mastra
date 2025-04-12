import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tool, Context } from 'tylerbarnes-fastmcp-fix';
import { z } from 'zod';
import { fromPackageRoot } from '../utils';

const courseDir = fromPackageRoot('.docs/organized/course');

const coursePrompt = `
  This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
  Please help the user through the steps of the course by walking them through the content and following the course
  to write the initial version of the code for them. The goal is to show them how the code works and explain it as they go
  through the course.

  Each course lesson can be run independently of other lessons in the course but the lessons do cover more challenging topics
  as the course goes on. Each lesson is broken up into steps. 
`;

async function listCourseLessons(): Promise<Array<{ name: string }>> {
  try {
    const files = await fs.readdir(courseDir);
    return files
      .map(f => ({
        name: f.replace('.md', ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function listCourseSteps(): Promise<Array<{ name: string; path: string }>> {
  try {
    const files = await fs.readdir(courseDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f.replace('.md', ''),
        path: f,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function readCourseStep(filename: string): Promise<string> {
  const filePath = path.join(courseDir, filename);

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    const steps = await listCourseSteps();
    const availableSteps = steps.map(ex => `- ${ex.name}`).join('\n');
    throw new Error(`Lesson "${filename}" not found.\n\nAvailable lessons:\n${availableSteps}`);
  }
}

const initialLessons = await listCourseLessons();
const lessonsListing =
  initialLessons.length > 0
    ? '\n\nAvailable Lessons: ' + initialLessons.map(ex => ex.name).join('\n')
    : '\n\nNo lessons available yet. Run the documentation preparation script first.';

export const startMastraCourse: Tool<any> = {
  name: 'startMastraCourse',
  description:
    'Starts the Mastra Course. If this is the first time a user tries to start the course it will start at the first lesson, otherwise it will pick up where they last left off',
  execute: async (_context: Context<any>) => {
    // Try to load the users course progress.

    // If the user has course progress, we compare it against the new course outline to see if anything changed.
    // If the user has completed a step that no longer exists or if a new step was added in between, then we let the user
    // know what changed in the course outline and then display their status.

    // If nothing changed or if the changes don't impact the current progress, we start the next lesson.

    // If they don't have any progress, create a new JSON file to store progress and get the first lesson.
    return 'TODO: Lesson would go here';
  },
};

export const getMastraCourseStatus: Tool<any> = {
  name: 'getMastraCourseStatus',
  description:
    'This will display the current progress in the Mastra Course. It will list all of the course lessons and the completion status of each step of the lessons',
  execute: async (_context: Context<any>) => {
    return 'TODO: Formatted course status will go here';
  },
};

const courseLessonSchema = z.object({
  lessonName: z
    .string()
    .optional()
    .describe(
      'Name of the specific lesson to start. It must match the exact lesson name. Only use one of lessonName or lessonNumber',
    ),
  lessonNumber: z
    .number()
    .optional()
    .describe(
      'Number of the specific lesson to start. It must match an available lesson number. Only use one of lessonName or lessonNumber',
    ),
});

type LessonParams = z.infer<typeof courseLessonSchema>;

export const startMastraCourseLesson: Tool<any> = {
  name: 'startMastraCourseLesson',
  description: 'This allows a user to start a new Mastra Course lesson by name or lesson number.',
  parameters: courseLessonSchema,
  execute: async (args: LessonParams, _context: Context<any>) => {
    // Check if the lesson is available.
    // Save user state on the current lesson
    // Return the correct step from that lesson
    return 'TODO: ';
  },
};

// Tools:
//   - startMastraCourse: this will start the mastra course and pick up the active lesson
//   - getMastraCourseStatus: this returns a list of all the course lessons and their status
//   - startMastraCourseLesson: this allows a user to start a different lesson by name
//   - nextMastraCourseStep: this is triggered when a user finishes a course step and starts the next one automatically
//   - clearMastraCourseHistory: this is triggered when a user wants to start the course completely over. Requires confirmation.
//
// TODO:
//   - Create a getCourseLesson function to return the content from the current lesson
