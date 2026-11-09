import { z } from 'zod';
import { addDays, type IsoDay } from '@cm/core/dates';
import { LEVEL_GROUPS } from '@cm/core/screener';
import { krillJobPageSchema } from '@cm/core/krillJob';
import type { JobsRepository, JobsQuery } from '../modules/jobs/domain.ts';
import { sourceUnavailable } from '../http/errors.ts';
import type { KrillLive } from './krillLive.ts';

export function createUpstreamJobs(
  live: KrillLive,
  today: () => IsoDay = () => new Date().toISOString().slice(0, 10) as IsoDay,
): JobsRepository {
  // Bounded by the transport cache; checkpoints only speed access to subsequent pages.
  const cursors = new Map<
    string,
    { at: number; pages: Map<number, string | null> }
  >();
  return {
    lookup: (id) =>
      live.job(id).catch(() => {
        throw sourceUnavailable();
      }),
    similar: (params) => live.jobs(params),
    async list(query: JobsQuery) {
      const params: Record<string, string | number | undefined> = {
        q: query.q,
        company: query.company,
        family: query.family,
        specialty: query.specialty,
        skills: query.skill,
        region: query.region,
        country: query.country,
        workMode: query.workMode,
        level:
          LEVEL_GROUPS.find((g) => g.key === query.level)?.levels.join(',') ??
          query.level,
        openedSince: query.postedWithin
          ? addDays(today(), -query.postedWithin)
          : undefined,
        salaryMin: query.salaryMin ?? (query.hasPay === 'true' ? 1 : undefined),
        currency:
          query.salaryMin !== undefined ||
          query.hasPay === 'true' ||
          query.sort === 'salary'
            ? query.currency
            : undefined,
      };
      const key = JSON.stringify({
        ...params,
        sort: query.sort,
        pageSize: query.pageSize,
      });
      let checkpoint = cursors.get(key);
      if (!checkpoint || Date.now() - checkpoint.at > 300_000) {
        checkpoint = { at: Date.now(), pages: new Map([[1, null]]) };
        cursors.set(key, checkpoint);
      }
      const checkpoints = checkpoint.pages;
      if (cursors.size > 200) cursors.delete(cursors.keys().next().value!);
      const total = await live.get(
        '/v1/facets',
        { ...params, limit: 1 },
        z.object({ total: z.number().int().nonnegative() }),
      );
      if ((query.page - 1) * query.pageSize >= total.total)
        return {
          items: [],
          page: query.page,
          pageSize: query.pageSize,
          total: total.total,
        };
      let page = Math.max(
        ...[...checkpoints.keys()].filter((p) => p <= query.page),
      );
      let cursor = checkpoints.get(page) ?? null;
      while (true) {
        const result = await live.get(
          '/v1/jobs',
          {
            ...params,
            sort: query.sort,
            pageSize: query.pageSize,
            cursor: cursor ?? undefined,
          },
          krillJobPageSchema,
        );
        checkpoints.set(page + 1, result.nextCursor);
        if (page === query.page)
          return {
            items: result.items,
            page: query.page,
            pageSize: query.pageSize,
            total: total.total,
          };
        if (!result.nextCursor)
          return {
            items: [],
            page: query.page,
            pageSize: query.pageSize,
            total: total.total,
          };
        cursor = result.nextCursor;
        page++;
      }
    },
  };
}
