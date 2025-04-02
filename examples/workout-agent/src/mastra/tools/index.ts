import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const exerciseLogSchema = z.object({
  exercise: z.string(),
  sentiment: z.string(),
  sets: z.number(),
  reps: z.number(),
});

export type ExerciseLogInput = z.infer<typeof exerciseLogSchema>;

export const exerciseLogTool = createTool({
  id: 'log_exercise',
  inputSchema: exerciseLogSchema,
  description: "Log the user's workout",
  execute: async ({ context, mastra }) => {
    console.log('Exercise logged', context);

    // mastra?.storage?.insert({
    //   collection: 'exercise_logs',
    //   data: context,
    // });

    return context;
  },
});

export const getWorkoutSummarySchema = z.object({});

export type WorkoutSummaryInput = z.infer<typeof getWorkoutSummarySchema>;

export const workoutSummaryTool = createTool({
  id: 'get_workout_summary',
  inputSchema: getWorkoutSummarySchema,
  description: "Get the summary of the user's workout",
  execute: async ({ context }) => {
    console.log('Workout summarized', context);
    return context;
  },
});
