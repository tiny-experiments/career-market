import { z } from 'zod';

/**
 * zod parsers for every krill response the builder reads. Objects are not
 * strict: krill may add fields without breaking the builder, but a missing or
 * mistyped field fails the build loudly.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().nonnegative();

export const metaSchema = z.object({
  taxonomy: z.object({ version: z.number().int(), hash: z.string() }),
  lastSnapshotDate: day.nullable(),
  openJobs: count,
  companies: count,
  boards: count,
  ats: z.array(z.object({ ats: z.string(), openJobs: count })),
});
export type KrillMeta = z.infer<typeof metaSchema>;

export const dailyStatsSchema = z.object({
  from: day,
  to: day,
  groupBy: z.array(z.string()),
  items: z.array(
    z.object({
      date: day,
      family: z.string().optional(),
      specialty: z.string().nullable().optional(),
      level: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      open: count,
      new: count,
      closed: count,
      opened: count,
    }),
  ),
});
export type KrillDailyStats = z.infer<typeof dailyStatsSchema>;
export type KrillDailyItem = KrillDailyStats['items'][number];

export const panelDailySchema = z.object({
  from: day,
  to: day,
  items: z.array(
    z.object({
      date: day,
      boardsOk: count,
      firstFetchBoards: count,
      newOnKnownBoards: count,
      matchedBoards: count,
      matchedOpen: count,
      matchedPreviousOpen: count,
    }),
  ),
});
export type KrillPanelDaily = z.infer<typeof panelDailySchema>;
export type KrillPanelItem = KrillPanelDaily['items'][number];

const facetList = z.array(z.object({ value: z.string(), count }));
export const facetsSchema = z.object({
  total: count,
  facets: z.object({
    family: facetList,
    specialty: facetList,
    level: facetList,
    skill: facetList,
    language: facetList,
    country: facetList,
    workMode: facetList,
    ats: facetList,
  }),
});
export type KrillFacets = z.infer<typeof facetsSchema>;

export const companyPageSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string(), openJobs: count, ats: z.array(z.string()) })),
  pageSize: z.number().int(),
  nextCursor: z.string().nullable(),
});
export type KrillCompanyPage = z.infer<typeof companyPageSchema>;

export const taxonomySchema = z.object({
  version: z.number().int(),
  hash: z.string(),
  families: z.array(z.object({ id: z.string(), specialties: z.array(z.string()) })),
  levels: z.array(z.string()),
  skills: z.array(z.object({ id: z.string(), namespace: z.string(), pack: z.string(), aliases: z.array(z.string()) })),
});
export type KrillTaxonomy = z.infer<typeof taxonomySchema>;

export const changePageSchema = z.object({
  items: z.array(
    z.object({
      jobId: z.string(),
      kind: z.enum(['opened', 'updated', 'reopened', 'closed']),
      date: day,
      closeReason: z.string().nullable(),
    }),
  ),
  pageSize: z.number().int(),
  nextCursor: z.string().nullable(),
});
export type KrillChangePage = z.infer<typeof changePageSchema>;

/** /v1/jobs/{id} answers 410 with this body once a job closed. */
export const tombstoneSchema = z.object({
  id: z.string(),
  status: z.literal('closed'),
  closedAt: day,
  openedAt: day,
  openedSource: z.enum(['posted', 'first_seen']),
  family: z.string().nullable(),
});
export type KrillTombstone = z.infer<typeof tombstoneSchema>;

/** An open job (a closed job that reopened before we sampled it); only status matters. */
export const openJobStatusSchema = z.object({ id: z.string(), status: z.literal('open') });
