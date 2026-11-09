import { z } from 'zod';
export const indexQuerySchema = z.strictObject({});
export const detailParamsSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9][a-z0-9.+_-]{0,63}$/),
});
