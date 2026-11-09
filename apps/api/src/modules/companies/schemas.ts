import { z } from 'zod';
import { pagingShape } from '../../database/paging.ts';
export const companiesQuerySchema = z.strictObject({
  ...pagingShape,
  q: z.string().trim().max(160).optional(),
  signal: z.enum(['ramping', 'steady', 'cooling', 'freezing']).optional(),
  sort: z.enum(['open', 'name', 'change1w', 'rank']).default('open'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export const companyParamsSchema = z.strictObject({
  slug: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
});
