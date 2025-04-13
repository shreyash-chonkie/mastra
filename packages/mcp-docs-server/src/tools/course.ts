import { existsSync, mkdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Tool, Context } from 'tylerbarnes-fastmcp-fix';
import { z } from 'zod';
import { fromPackageRoot } from '../utils';

const courseDir = fromPackageRoot('.docs/raw/course');
const courseSchema = fromPackageRoot('.docs/course/courseSchema.json');

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
      .filter(f => !f.startsWith('.')) // Skip hidden files
      .map(f => ({
        name: f.replace(/^\d+-/, ''), // Remove numbering prefix
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function listCourseSteps(lessonName: string): Promise<Array<{ name: string; path: string }>> {
  try {
    // Find the lesson directory that matches the name
    const lessonDirs = await fs.readdir(courseDir);
    const lessonDir = lessonDirs.find(dir => dir.replace(/^\d+-/, '') === lessonName);

    if (!lessonDir) {
      return [];
    }

    const lessonPath = path.join(courseDir, lessonDir);
    const files = await fs.readdir(lessonPath);

    return files
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f.replace(/^\d+-/, '').replace('.md', ''),
        path: path.join(lessonDir, f),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function readCourseStep(lessonName: string, stepName: string): Promise<string> {
  // Find the lesson directory that matches the name
  const lessonDirs = await fs.readdir(courseDir);
  const lessonDir = lessonDirs.find(dir => dir.replace(/^\d+-/, '') === lessonName);

  if (!lessonDir) {
    const lessons = await listCourseLessons();
    const availableLessons = lessons.map(l => `- ${l.name}`).join('\n');
    throw new Error(`Lesson "${lessonName}" not found.\n\nAvailable lessons:\n${availableLessons}`);
  }

  // Find the step file that matches the name
  const lessonPath = path.join(courseDir, lessonDir);
  const stepFiles = await fs.readdir(lessonPath);
  const stepFile = stepFiles.find(f => f.replace(/^\d+-/, '').replace('.md', '') === stepName);

  if (!stepFile) {
    const steps = await listCourseSteps(lessonName);
    const availableSteps = steps.map(s => `- ${s.name}`).join('\n');
    throw new Error(`Step "${stepName}" not found in lesson "${lessonName}".\n\nAvailable steps:\n${availableSteps}`);
  }

  const filePath = path.join(courseDir, lessonDir, stepFile);

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Failed to read step "${stepName}" in lesson "${lessonName}".`);
  }
}

// Define the course state schema
const courseStepSchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.number(), // 0: not started, 1: in progress, 2: completed
});

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

const _courseStateSchema = z.object({
  currentLesson: z.string(),
  lessons: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      status: z.number(), // 0: not started, 1: in progress, 2: completed
      steps: z.array(courseStepSchema),
    }),
  ),
});

type LessonParams = z.infer<typeof courseLessonSchema>;
type CourseState = z.infer<typeof _courseStateSchema>;

async function getCourseStatePath(): Promise<string> {
  const stateDirPath = path.join(os.homedir(), '.cache', 'mastra', 'course');

  // Ensure the directory exists
  if (!existsSync(stateDirPath)) {
    mkdirSync(stateDirPath, { recursive: true });
  }

  return path.join(stateDirPath, 'state.json');
}

async function loadCourseState(): Promise<CourseState | null> {
  const statePath = await getCourseStatePath();

  try {
    if (existsSync(statePath)) {
      const stateData = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(stateData) as CourseState;
    }
  } catch (error) {
    console.error('Error loading course state:', error);
  }

  return null;
}

async function saveCourseState(state: CourseState): Promise<void> {
  const statePath = await getCourseStatePath();

  try {
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving course state:', error);
    throw new Error('Failed to save course state');
  }
}

async function scanCourseContent(): Promise<CourseState> {
  // Scan the course directory to build a fresh state
  const lessonDirs = await fs.readdir(courseDir);

  const lessons = await Promise.all(
    lessonDirs
      .filter(dir => !dir.startsWith('.')) // Skip hidden directories
      .sort((a, b) => a.localeCompare(b))
      .map(async lessonDir => {
        const lessonPath = path.join(courseDir, lessonDir);
        const lessonStats = await fs.stat(lessonPath);

        if (!lessonStats.isDirectory()) return null;

        // Extract lesson name from directory (remove numbering prefix)
        const lessonName = lessonDir.replace(/^\d+-/, '');

        // Get all markdown files in the lesson directory
        const stepFiles = (await fs.readdir(lessonPath))
          .filter(file => file.endsWith('.md'))
          .sort((a, b) => a.localeCompare(b));

        // Build steps array
        const steps = await Promise.all(
          stepFiles.map(async stepFile => {
            const stepPath = path.join(lessonPath, stepFile);
            const content = await fs.readFile(stepPath, 'utf-8');

            // Extract step name from filename (remove numbering prefix)
            const stepName = stepFile.replace(/^\d+-/, '').replace('.md', '');

            // Extract description from the first heading in the markdown
            const descriptionMatch = content.match(/^#\s+(.+)$/m);
            const description = descriptionMatch ? descriptionMatch[1] : stepName;

            return {
              name: stepName,
              description,
              status: 0, // Default: not started
            };
          }),
        );

        return {
          name: lessonName,
          description: lessonName, // Default description is the name
          status: 0, // Default: not started
          steps: steps.filter(Boolean),
        };
      }),
  );

  // Filter out null values and create the state
  const validLessons = lessons.filter((lesson): lesson is NonNullable<typeof lesson> => lesson !== null);

  return {
    currentLesson: validLessons.length > 0 ? validLessons[0].name : '',
    lessons: validLessons,
  };
}

async function mergeCourseStates(currentState: CourseState, newState: CourseState): Promise<CourseState> {
  // Create a map of existing lessons by name for easy lookup
  const existingLessonMap = new Map(currentState.lessons.map(lesson => [lesson.name, lesson]));

  // Merge the states, preserving progress where possible
  const mergedLessons = newState.lessons.map(newLesson => {
    const existingLesson = existingLessonMap.get(newLesson.name);

    if (!existingLesson) {
      // This is a new lesson
      return newLesson;
    }

    // Create a map of existing steps by name
    const existingStepMap = new Map(existingLesson.steps.map(step => [step.name, step]));

    // Merge steps, preserving progress for existing steps
    const mergedSteps = newLesson.steps.map(newStep => {
      const existingStep = existingStepMap.get(newStep.name);

      if (existingStep) {
        // Preserve the status from the existing step
        return {
          ...newStep,
          status: existingStep.status,
        };
      }

      return newStep;
    });

    // Calculate lesson status based on steps
    let lessonStatus = existingLesson.status;
    if (mergedSteps.every(step => step.status === 2)) {
      lessonStatus = 2; // Completed
    } else if (mergedSteps.some(step => step.status > 0)) {
      lessonStatus = 1; // In progress
    }

    return {
      ...newLesson,
      status: lessonStatus,
      steps: mergedSteps,
    };
  });

  // Determine current lesson
  let currentLesson = currentState.currentLesson;

  // If the current lesson doesn't exist in the new state, reset to the first lesson
  if (!mergedLessons.some(lesson => lesson.name === currentLesson) && mergedLessons.length > 0) {
    currentLesson = mergedLessons[0].name;
  }

  return {
    currentLesson,
    lessons: mergedLessons,
  };
}

const initialLessons = await listCourseLessons();
const _lessonsListing =
  initialLessons.length > 0
    ? '\n\nAvailable Lessons: ' + initialLessons.map(ex => ex.name).join('\n')
    : '\n\nNo lessons available yet. Run the documentation preparation script first.';

export const startMastraCourse: Tool<any> = {
  name: 'startMastraCourse',
  description:
    'Starts the Mastra Course. If this is the first time a user tries to start the course it will start at the first lesson, otherwise it will pick up where they last left off',
  execute: async (_context: Context<any>) => {
    try {
      // Try to load the user's course progress
      let courseState = await loadCourseState();
      let statusMessage = '';

      // Get the latest course content structure
      const latestCourseState = await scanCourseContent();

      if (!latestCourseState.lessons.length) {
        return 'No course content found. Please make sure the course content is properly set up in the .docs/course/lessons directory.';
      }

      if (courseState) {
        // User has existing progress, merge with latest content
        const previousState = JSON.parse(JSON.stringify(courseState)) as CourseState; // Deep clone for comparison
        courseState = await mergeCourseStates(courseState, latestCourseState);

        // Check if there are differences in the course structure
        const newLessons = latestCourseState.lessons.filter(
          newLesson => !previousState.lessons.some((oldLesson: { name: string }) => oldLesson.name === newLesson.name),
        );

        if (newLessons.length > 0) {
          statusMessage = `📚 Course content has been updated! ${newLessons.length} new lesson(s) have been added:\n`;
          statusMessage += newLessons.map(lesson => `- ${lesson.name}`).join('\n');
          statusMessage += '\n\n';
        }

        // Save the merged state
        await saveCourseState(courseState);
      } else {
        // First time user, create new state
        courseState = latestCourseState;
        await saveCourseState(courseState);
        statusMessage = '🎉 Welcome to the Mastra Course! Starting with the first lesson.\n\n';
      }

      // Find the current lesson and step
      const currentLessonName = courseState.currentLesson;
      const currentLesson = courseState.lessons.find(lesson => lesson.name === currentLessonName);

      if (!currentLesson) {
        return 'Error: Current lesson not found in course content. Please try again or reset your course progress.';
      }

      // Find the first incomplete step in the current lesson
      const currentStep = currentLesson.steps.find(step => step.status !== 2);

      if (!currentStep && currentLesson.status !== 2) {
        // Mark the lesson as completed if all steps are done
        currentLesson.status = 2;
        await saveCourseState(courseState);

        // Find the next lesson that's not completed
        const nextLesson = courseState.lessons.find(lesson => lesson.status !== 2 && lesson.name !== currentLessonName);

        if (nextLesson) {
          courseState.currentLesson = nextLesson.name;
          await saveCourseState(courseState);

          return `${statusMessage}🎉 You've completed the "${currentLessonName}" lesson!\n\nMoving on to the next lesson: "${nextLesson.name}".\n\nUse the \`nextMastraCourseStep\` tool to start the first step of this lesson.`;
        } else {
          return `${statusMessage}🎉 Congratulations! You've completed all available lessons in the Mastra Course!\n\nIf you'd like to review any lesson, use the \`startMastraCourseLesson\` tool with the lesson name.`;
        }
      }

      if (!currentStep) {
        // This should not happen, but just in case
        return `${statusMessage}Error: No incomplete steps found in the current lesson. Please try another lesson or reset your course progress.`;
      }

      // Mark the step as in progress
      currentStep.status = 1;

      // If the lesson is not in progress, mark it as in progress
      if (currentLesson.status === 0) {
        currentLesson.status = 1;
      }

      // Save the updated state
      await saveCourseState(courseState);

      // Get the content for the current step
      const stepContent = await readCourseStep(currentLessonName, currentStep.name);

      return `${statusMessage}📘 Lesson: ${currentLessonName}\n📝 Step: ${currentStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
    } catch (error: unknown) {
      console.error('Error starting Mastra course:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error starting the Mastra course: ${errorMessage}`;
    }
  },
};

export const getMastraCourseStatus: Tool<any> = {
  name: 'getMastraCourseStatus',
  description:
    'This will display the current progress in the Mastra Course. It will list all of the course lessons and the completion status of each step of the lessons',
  execute: async (_context: Context<any>) => {
    try {
      // Load the current course state
      const courseState = await loadCourseState();

      if (!courseState) {
        return 'No course progress found. Please start the course first using the `startMastraCourse` tool.';
      }

      // Get the latest course content structure to ensure we have the most up-to-date information
      const latestCourseState = await scanCourseContent();

      if (!latestCourseState.lessons.length) {
        return 'No course content found. Please make sure the course content is properly set up in the .docs/course/lessons directory.';
      }

      // Merge the states to ensure we have the latest content with the user's progress
      const mergedState = await mergeCourseStates(courseState, latestCourseState);

      // Build a formatted status report
      let statusReport = '# Mastra Course Progress\n\n';

      // Add overall progress stats
      const totalLessons = mergedState.lessons.length;
      const completedLessons = mergedState.lessons.filter(lesson => lesson.status === 2).length;
      const _inProgressLessons = mergedState.lessons.filter(lesson => lesson.status === 1).length;

      const totalSteps = mergedState.lessons.reduce((sum, lesson) => sum + lesson.steps.length, 0);
      const completedSteps = mergedState.lessons.reduce(
        (sum, lesson) => sum + lesson.steps.filter(step => step.status === 2).length,
        0,
      );

      statusReport += `## Overall Progress\n`;
      statusReport += `- Current Lesson: **${mergedState.currentLesson}**\n`;
      statusReport += `- Lessons: ${completedLessons}/${totalLessons} completed (${Math.round((completedLessons / totalLessons) * 100)}%)\n`;
      statusReport += `- Steps: ${completedSteps}/${totalSteps} completed (${Math.round((completedSteps / totalSteps) * 100)}%)\n\n`;

      // Add detailed lesson status
      statusReport += `## Lesson Details\n\n`;

      mergedState.lessons.forEach((lesson, lessonIndex) => {
        // Determine lesson status icon
        let lessonStatusIcon = '⬜'; // Not started
        if (lesson.status === 1) lessonStatusIcon = '🔶'; // In progress
        if (lesson.status === 2) lessonStatusIcon = '✅'; // Completed

        // Highlight current lesson
        const isCurrent = lesson.name === mergedState.currentLesson;
        const lessonPrefix = isCurrent ? '👉 ' : '';

        statusReport += `### ${lessonPrefix}${lessonIndex + 1}. ${lessonStatusIcon} ${lesson.name}\n\n`;

        // Add step details
        lesson.steps.forEach((step, stepIndex) => {
          // Determine step status icon
          let stepStatusIcon = '⬜'; // Not started
          if (step.status === 1) stepStatusIcon = '🔶'; // In progress
          if (step.status === 2) stepStatusIcon = '✅'; // Completed

          statusReport += `- ${stepStatusIcon} Step ${stepIndex + 1}: ${step.name}\n`;
        });

        statusReport += '\n';
      });

      // Add navigation instructions
      statusReport += `## Navigation\n\n`;
      statusReport += `- To continue the course: \`nextMastraCourseStep\`\n`;
      statusReport += `- To start a specific lesson: \`startMastraCourseLesson\`\n`;
      statusReport += `- To reset progress: \`clearMastraCourseHistory\`\n`;

      return statusReport;
    } catch (error: unknown) {
      console.error('Error getting course status:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error getting course status: ${errorMessage}`;
    }
  },
};

export const startMastraCourseLesson: Tool<any> = {
  name: 'startMastraCourseLesson',
  description: 'This allows a user to start a new Mastra Course lesson by name or lesson number.',
  parameters: courseLessonSchema,
  execute: async (args: LessonParams, _context: Context<any>) => {
    try {
      // Load the current course state
      let courseState = await loadCourseState();

      // If no state exists, create a new one
      if (!courseState) {
        courseState = await scanCourseContent();

        if (!courseState.lessons.length) {
          return 'No course content found. Please make sure the course content is properly set up in the .docs/course/lessons directory.';
        }
      } else {
        // Ensure we have the latest course content
        const latestCourseState = await scanCourseContent();
        courseState = await mergeCourseStates(courseState, latestCourseState);
      }

      // Find the requested lesson
      let targetLesson: (typeof courseState.lessons)[0] | undefined;

      if (args.lessonName) {
        // Find by name
        targetLesson = courseState.lessons.find(lesson => lesson.name.toLowerCase() === args.lessonName!.toLowerCase());
      } else if (args.lessonNumber !== undefined) {
        // Find by number (1-based index)
        if (args.lessonNumber > 0 && args.lessonNumber <= courseState.lessons.length) {
          targetLesson = courseState.lessons[args.lessonNumber - 1];
        }
      }

      if (!targetLesson) {
        // Lesson not found, provide a list of available lessons
        const availableLessons = courseState.lessons.map((lesson, index) => `${index + 1}. ${lesson.name}`).join('\n');

        return `Lesson not found. Please specify a valid lesson name or number.\n\nAvailable lessons:\n${availableLessons}`;
      }

      // Update the current lesson in the state
      courseState.currentLesson = targetLesson.name;

      // Find the first incomplete step in the lesson, or the first step if all are completed
      const firstIncompleteStep = targetLesson.steps.find(step => step.status !== 2) || targetLesson.steps[0];

      if (!firstIncompleteStep) {
        return `The lesson "${targetLesson.name}" does not have any steps.`;
      }

      // Mark the step as in progress
      firstIncompleteStep.status = 1;

      // If the lesson is not in progress or completed, mark it as in progress
      if (targetLesson.status === 0) {
        targetLesson.status = 1;
      }

      // Save the updated state
      await saveCourseState(courseState);

      // Get the content for the step
      const stepContent = await readCourseStep(targetLesson.name, firstIncompleteStep.name);

      return `📘 Starting Lesson: ${targetLesson.name}\n📝 Step: ${firstIncompleteStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
    } catch (error: unknown) {
      console.error('Error starting course lesson:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error starting course lesson: ${errorMessage}`;
    }
  },
};

export const nextMastraCourseStep: Tool<any> = {
  name: 'nextMastraCourseStep',
  description:
    'Marks the current step as completed and moves to the next step in the course. If all steps in a lesson are completed, it moves to the next lesson.',
  execute: async (_context: Context<any>) => {
    try {
      // Load the current course state
      const courseState = await loadCourseState();

      if (!courseState) {
        return 'No course progress found. Please start the course first using the `startMastraCourse` tool.';
      }

      // Find the current lesson
      const currentLessonName = courseState.currentLesson;
      const currentLesson = courseState.lessons.find(lesson => lesson.name === currentLessonName);

      if (!currentLesson) {
        return 'Error: Current lesson not found in course content. Please try again or reset your course progress.';
      }

      // Find the current in-progress step
      const currentStepIndex = currentLesson.steps.findIndex(step => step.status === 1);

      if (currentStepIndex === -1) {
        return 'No step is currently in progress. Please start a step first using the `startMastraCourse` tool.';
      }

      // Mark the current step as completed
      currentLesson.steps[currentStepIndex].status = 2; // Completed

      // Find the next step in the current lesson
      const nextStepIndex = currentLesson.steps.findIndex(
        (step, index) => index > currentStepIndex && step.status !== 2,
      );

      // If there's a next step in the current lesson
      if (nextStepIndex !== -1) {
        // Mark the next step as in progress
        currentLesson.steps[nextStepIndex].status = 1; // In progress

        // Save the updated state
        await saveCourseState(courseState);

        // Get the content for the next step
        const nextStep = currentLesson.steps[nextStepIndex];
        const stepContent = await readCourseStep(currentLessonName, nextStep.name);

        return `🎉 Step "${currentLesson.steps[currentStepIndex].name}" completed!\n\n📘 Continuing Lesson: ${currentLessonName}\n📝 Next Step: ${nextStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
      }

      // All steps in the current lesson are completed
      // Mark the lesson as completed
      currentLesson.status = 2; // Completed

      // Find the next lesson that's not completed
      const currentLessonIndex = courseState.lessons.findIndex(lesson => lesson.name === currentLessonName);
      const nextLesson = courseState.lessons.find((lesson, index) => index > currentLessonIndex && lesson.status !== 2);

      if (nextLesson) {
        // Update the current lesson to the next lesson
        courseState.currentLesson = nextLesson.name;

        // Mark the first step of the next lesson as in progress
        if (nextLesson.steps.length > 0) {
          nextLesson.steps[0].status = 1; // In progress
        }

        // Mark the next lesson as in progress
        nextLesson.status = 1; // In progress

        // Save the updated state
        await saveCourseState(courseState);

        // Get the content for the first step of the next lesson
        const firstStep = nextLesson.steps[0];
        const stepContent = await readCourseStep(nextLesson.name, firstStep.name);

        return `🎉 Congratulations! You've completed the "${currentLessonName}" lesson!\n\n📘 Starting New Lesson: ${nextLesson.name}\n📝 First Step: ${firstStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
      }

      // All lessons are completed
      await saveCourseState(courseState);

      return `🎉 Congratulations! You've completed all available lessons in the Mastra Course!\n\nIf you'd like to review any lesson, use the \`startMastraCourseLesson\` tool with the lesson name.`;
    } catch (error: unknown) {
      console.error('Error advancing course step:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error advancing to the next course step: ${errorMessage}`;
    }
  },
};

// Schema for the confirmation parameter
const confirmationSchema = z.object({
  confirm: z
    .boolean()
    .describe('Set to true to confirm that you want to clear all course progress. This action cannot be undone.'),
});

type ConfirmationParams = z.infer<typeof confirmationSchema>;

export const clearMastraCourseHistory: Tool<any> = {
  name: 'clearMastraCourseHistory',
  description:
    'Resets all course progress and starts the course from the beginning. This action requires confirmation and cannot be undone.',
  parameters: confirmationSchema,
  execute: async (args: ConfirmationParams, _context: Context<any>) => {
    try {
      // Check if the user has confirmed the action
      if (!args.confirm) {
        return '⚠️ This action will delete all your course progress and cannot be undone. To proceed, please run this tool again with the confirm parameter set to true.';
      }

      // Get the state file path
      const statePath = await getCourseStatePath();

      // Check if the state file exists
      if (!existsSync(statePath)) {
        return 'No course progress found. Nothing to clear.';
      }

      // Delete the state file
      await fs.unlink(statePath);

      // Scan the course content to get the first lesson
      const freshCourseState = await scanCourseContent();

      if (!freshCourseState.lessons.length) {
        return '🧹 Course progress has been cleared. No course content found to start a new course.';
      }

      // Get the first lesson and step
      const firstLesson = freshCourseState.lessons[0];
      const firstStep = firstLesson.steps[0];

      if (!firstStep) {
        return '🧹 Course progress has been cleared. The first lesson does not have any steps.';
      }

      // Return a message with the first lesson and step
      const stepContent = await readCourseStep(firstLesson.name, firstStep.name);

      return `🧹 Course progress has been cleared. Starting from the beginning.\n\n📘 Lesson: ${firstLesson.name}\n📝 Step: ${firstStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
    } catch (error: unknown) {
      console.error('Error clearing course history:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error clearing course history: ${errorMessage}`;
    }
  },
};
