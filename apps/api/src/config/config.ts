import { z } from 'zod';
const schema = z.strictObject({
  trustProxy: z.coerce.number().int().min(0).max(5).default(0),
});
export const apiConfig = schema.parse({
  trustProxy: process.env.API_TRUST_PROXY,
});
