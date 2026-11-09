import { z } from 'zod';
export const indexQuerySchema = z.strictObject({
  region: z
    .enum(['north-america', 'europe', 'apac', 'latam', 'mena'])
    .optional(),
});
export const detailParamsSchema = z.strictObject({
  code: z.string().regex(/^[a-zA-Z0-9-]{1,40}$/),
});
