import type { z } from 'zod';
import type {
  KrillJob,
  KrillJobDetail,
  KrillTombstone,
} from '@cm/core/krillJob';
import type { IsoDay } from '@cm/core/dates';
import type { Page } from '../../database/paging.ts';
import type { jobsQuerySchema } from './schemas.ts';

export type JobsQuery = z.infer<typeof jobsQuerySchema> & {
  /** Part of an employer's name, when the words typed are not a company's id or slug. */
  companyContains?: string | undefined;
};
/** Roles only the closing record remembers have no posting dates or profession. */
export type JobTombstone = Pick<KrillTombstone, 'id' | 'status' | 'closedAt'> & {
  openedAt: IsoDay | null;
  openedSource: KrillTombstone['openedSource'] | null;
  family: string | null;
};
export type JobLookup =
  | { kind: 'open'; job: KrillJobDetail }
  | { kind: 'closed'; tombstone: JobTombstone }
  | { kind: 'missing' };
export interface SimilarQuery {
  family?: string | undefined;
  specialty?: string | undefined;
  level?: string | undefined;
  country?: string | undefined;
  skillsAny?: readonly string[] | undefined;
  limit: number;
}
export interface JobsPulseCounts {
  open: number;
  newToday: number;
  withPay: number;
}
/** Every read of a job. HTTP modules never depend on its storage. */
export interface JobsRepository {
  lookup(id: string): Promise<JobLookup>;
  list(query: JobsQuery): Promise<Page<KrillJob>>;
  similar(params: SimilarQuery): Promise<KrillJob[]>;
  pulseCounts(): Promise<JobsPulseCounts>;
}
export interface JobListItem {
  id: string;
  title: string;
  company: { id: string; name: string; domain: string | null };
  location: string | null;
  moreLocations: number;
  workMode: string | null;
  level: string | null;
  family: string | null;
  familyName: string | null;
  salary: KrillJob['salary'];
  openedAt: string;
  ageDays: number | null;
  repostCount: number;
  href: string;
}
export type JobsPage = Page<JobListItem> & {
  /** The employer the list is narrowed to, when the address named one by id or slug. */
  filterCompany?: { id: string; slug: string; name: string } | null;
};

export { jobsQuerySchema } from './schemas.ts';
