import type { z } from 'zod';
import { validationFailed } from './errors.ts';
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues)
    fields[issue.path.join('.') || '_root'] ??= issue.message;
  throw validationFailed(fields);
}
