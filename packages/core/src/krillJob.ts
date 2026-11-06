import { z } from 'zod';

/**
 * zod parsers for krill's job records (`/v1/jobs`, `/v1/jobs/{id}`). Shared by
 * the builder (pay bands) and the read API (the Job page). Objects are not
 * strict: krill may add fields without breaking Career Market, but a missing or
 * mistyped field fails loudly.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const salary = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  currency: z.string().nullable(),
  period: z.string().nullable(),
  annualMin: z.number().nullable(),
  annualMax: z.number().nullable(),
  source: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

const place = z.object({
  label: z.string(),
  countryCode: z.string().nullable(),
  admin1Code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
});

export const krillJobSchema = z.object({
  id: z.string(),
  status: z.literal('open'),
  title: z.string(),
  company: z.object({ id: z.string(), name: z.string() }),
  ats: z.string().nullable().optional(),
  url: z.string().nullable(),
  applyUrl: z.string().nullable(),
  employmentType: z.string().nullable(),
  workMode: z.string().nullable(),
  locations: z.array(z.string()),
  places: z.array(place),
  salary: salary.nullable(),
  postedAt: z.string().nullable(),
  openedAt: day,
  openedSource: z.enum(['posted', 'first_seen']),
  firstSeenAt: day,
  lastSeenAt: day,
  family: z.string().nullable(),
  specialty: z.string().nullable(),
  level: z.string().nullable(),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  tools: z.array(z.string()),
  ageDays: z.number().int().nullable(),
  repostCount: z.number().int(),
  staleScore: z.number().nullable(),
});
export type KrillJob = z.infer<typeof krillJobSchema>;

export const krillJobDetailSchema = krillJobSchema.extend({
  description: z.string().nullable(),
  skillEvidence: z
    .array(z.object({ id: z.string(), count: z.number().int(), where: z.array(z.string()).optional() }))
    .optional(),
});
export type KrillJobDetail = z.infer<typeof krillJobDetailSchema>;

export const krillJobPageSchema = z.object({
  items: z.array(krillJobSchema),
  pageSize: z.number().int(),
  nextCursor: z.string().nullable(),
});
export type KrillJobPage = z.infer<typeof krillJobPageSchema>;

/** `/v1/jobs/{id}` answers 410 with this body once a job closed. */
export const krillTombstoneSchema = z.object({
  id: z.string(),
  status: z.literal('closed'),
  closedAt: day,
  openedAt: day,
  openedSource: z.enum(['posted', 'first_seen']),
  family: z.string().nullable(),
});
export type KrillTombstone = z.infer<typeof krillTombstoneSchema>;

export const krillCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().nullable().optional(),
  openJobs: z.number().int(),
});
export type KrillCompany = z.infer<typeof krillCompanySchema>;

/** `/v1/stats/companies/daily` (krill K2): one row per company and day. */
export const krillCompanyDailySchema = z.object({
  from: day,
  to: day,
  items: z.array(
    z.object({
      date: day,
      companyId: z.string(),
      open: z.number().int(),
      new: z.number().int(),
      closed: z.number().int(),
    }),
  ),
  nextCursor: z.string().nullable().optional(),
});
export type KrillCompanyDaily = z.infer<typeof krillCompanyDailySchema>;
