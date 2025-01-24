import { pino as pinoLogger } from 'pino';

export type ValueOf<T extends NonNullable<unknown>> = T[keyof T];

export type EnumFromUnion<T extends string> = Readonly<{
  [K in T as Uppercase<K>]: K;
}>;

export const LoggerLevel: EnumFromUnion<pinoLogger.LevelWithSilent> = {
  DEBUG: 'debug',
  ERROR: 'error',
  FATAL: 'fatal',
  INFO: 'info',
  TRACE: 'trace',
  WARN: 'warn',
  SILENT: 'silent',
} as const;

export type LoggerLevelType = ValueOf<typeof LoggerLevel>;
