import type { z } from 'zod';
import type {
  KrillJob,
  KrillJobDetail,
  KrillTombstone,
} from '@cm/core/krillJob';
import type { Page } from '../../database/paging.ts';
import type { jobsQuerySchema } from './schemas.ts';

export type JobsQuery = z.infer<typeof jobsQuerySchema>;
export type JobLookup =
  | { kind: 'open'; job: KrillJobDetail }
  | { kind: 'closed'; tombstone: KrillTombstone }
  | { kind: 'missing' };
/** P3 supplies a Postgres adapter for this contract. HTTP modules never depend on its storage. */
export interface JobsRepository {
  lookup(id: string): Promise<JobLookup>;
  list(query: JobsQuery): Promise<Page<KrillJob>>;
  similar(
    params: Record<string, string | number | undefined>,
  ): Promise<KrillJob[]>;
}
export interface JobListItem {
  id: string;
  title: string;
  company: { id: string; name: string; domain: string | null };
  location: string | null;
  workMode: string | null;
  level: string | null;
  salary: KrillJob['salary'];
  openedAt: string;
  ageDays: number | null;
  href: string;
}
export type JobsPage = Page<JobListItem>;

export { jobsQuerySchema } from './schemas.ts';
