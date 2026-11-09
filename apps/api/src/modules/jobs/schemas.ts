import { z } from 'zod';
import { pagingShape } from '../../database/paging.ts';
export const jobsQuerySchema = z.strictObject({
  ...pagingShape,
  q: z.string().trim().max(80).optional(),
  company: z.string().trim().min(1).max(160).optional(),
  family: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional(),
  specialty: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
  skill: z
    .string()
    .regex(/^[a-z0-9:+#._-]{1,80}$/i)
    .optional(),
  region: z
    .enum([
      'north-america',
      'europe',
      'eu',
      'dach',
      'nordics',
      'benelux',
      'apac',
      'latam',
      'mena',
    ])
    .optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  workMode: z.enum(['remote', 'hybrid', 'onsite']).optional(),
  level: z
    .enum([
      'entry',
      'mid',
      'senior',
      'staff',
      'management',
      'intern',
      'junior',
      'principal',
      'manager',
      'director',
      'executive',
    ])
    .optional(),
  postedWithin: z.coerce.number().int().min(1).max(365).optional(),
  salaryMin: z.coerce.number().int().min(0).max(10000000).optional(),
  hasPay: z.literal('true').optional(),
  currency: z
    .enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF'])
    .default('USD'),
  sort: z.enum(['newest', 'opened', 'salary']).default('newest'),
});
export const jobParamsSchema = z.strictObject({
  id: z.string().regex(/^kr_[a-z0-9]{6,40}$/),
});
