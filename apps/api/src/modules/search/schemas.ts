import { z } from 'zod';
export const searchQuerySchema = z.strictObject({
  q: z.string().trim().max(80).default(''),
  limit: z.coerce.number().int().min(1).max(10).default(5),
  roles: z.enum(['0', '1']).default('0'),
});
