import { z } from 'zod';

export function hasProp<T>(target: T | undefined, key: keyof T): key is keyof T {
  return Boolean(target) && Object.prototype.hasOwnProperty.call(target, key);
}

export function getProp(target: unknown, paths: readonly (keyof any)[], defaultValue: any = undefined) {
  let value: any = target;
  if (!value) {
    return undefined;
  }

  for (const key of paths) {
    if (!hasProp(value, key)) {
      return defaultValue;
    }
    value = value[key];
  }
  return value;
}

export function getEnv(key: string) {
  return getProp(process.env, [key], undefined);
}

export function parseEnv<T>(key: string, schema: z.ZodType<T>, defaultValue?: T): T {
  const value = getEnv(key) ?? defaultValue;
  const result = schema.safeParse(value);
  if (!result.success) {
    if (value === undefined) {
      throw new Error(`Required variable '${key}' is not set!`);
    }

    throw new Error(`Failed to parse ENV variable (${key})!`);
  }
  return result.data;
}
parseEnv.asBoolean = (key: string, fallback = false) => {
  return parseEnv(key, z.string(), String(fallback)).trim().toLowerCase() === 'true';
};

export function hasEnv(key: string) {
  return getProp(process.env, [key]) !== undefined;
}
