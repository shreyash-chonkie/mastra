import { z } from 'zod';
import { ExecuteToolInputFn, Tool } from '@/lib/realtime';

const timerSchema = z.object({
  seconds: z.number(),
});

export type TimerInput = z.infer<typeof timerSchema>;

type CreateToolFn<I> = (fn: ExecuteToolInputFn<I>) => Tool<I>;

export const createTimerTool: CreateToolFn<TimerInput> = fn => ({
  id: 'create_timer',
  inputSchema: timerSchema,
  description: 'Create a timer for the user',
  execute: async ({ seconds }, { connection }) => {
    fn({ seconds }, { connection });

    return {
      message: 'Timer created',
    };
  },
});

export type WorkoutInput = z.infer<typeof generateWorkoutSchema>;

export const generateWorkoutSchema = z.object({
  name: z.string().describe('The name of the workout'),
  restTime: z.number().default(45).describe('The amount of time to rest between sets in seconds'),
  exercises: z.array(
    z.object({
      name: z.string().describe('The name of the exercise'),
      sets: z.number().describe('The number of sets'),
      reps: z.number().describe('The number of reps'),
    }),
  ),
});

export const createWorkoutTool: CreateToolFn<WorkoutInput> = fn => ({
  id: 'generate_workout',
  inputSchema: generateWorkoutSchema,
  description: 'Generate a workout for the user',
  execute: async ({ name, restTime, exercises }, { connection }) => {
    fn({ name, restTime, exercises }, { connection });

    return {
      message: 'Workout generated',
    };
  },
});
