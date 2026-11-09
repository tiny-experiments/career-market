import { z } from 'zod';
export const indexQuerySchema = z.strictObject({});
export const detailParamsSchema = z.strictObject({
  code: z.string().regex(/^[a-zA-Z0-9-]{1,40}$/),
});
