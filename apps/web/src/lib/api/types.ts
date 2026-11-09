/**
 * What the API answers. Payloads shared with the API come straight from
 * `@cm/core` (types only: nothing from it reaches the bundle); the few shapes
 * the API composes itself are mirrored here. Dates are ISO strings.
 */
import type { KrillJob } from "@cm/core/krillJob";
import type { SearchResults, RoleHit } from "@cm/core/screener";

export type {
  CompanyDirectoryRow,
  CompanyFacets,
  CompanyMover,
  CompanyPage,
  CompanySignalsOverview,
  CompanySignalState,
} from "@cm/core/company";
export type { ClosedJobPayload, JobPagePayload } from "@cm/core/job";
export type { ProfessionIndex, ProfessionPage } from "@cm/core/professions";
export type { RoleHit, SearchHit, SearchResults } from "@cm/core/screener";
export type {
  SkillIndexPayload,
  SkillIndexRow,
  SkillPagePayload,
} from "@cm/core/skills";
export type { Change, ChromePayload, MarketOverview } from "@cm/core/types";

export interface PageQuery {
  readonly page: number;
  readonly pageSize: number;
}

/** One page of a list: `?page&pageSize` in, this out. */
export interface Page<T> extends PageQuery {
  readonly items: readonly T[];
  readonly total: number;
}

export interface JobListItem {
  readonly id: string;
  readonly title: string;
  readonly company: {
    readonly id: string;
    readonly name: string;
    readonly domain: string | null;
  };
  readonly location: string | null;
  readonly workMode: string | null;
  readonly level: string | null;
  readonly salary: KrillJob["salary"];
  readonly openedAt: string;
  readonly ageDays: number | null;
  /** Our own job page. */
  readonly href: string;
}

export interface JobFacet {
  readonly kind: string;
  readonly value: string;
  readonly count: number;
}

export interface JobFacets {
  readonly facets: readonly JobFacet[];
}

export interface SiteSearchResults extends SearchResults {
  readonly roles: readonly RoleHit[];
  readonly rolesUnavailable: boolean;
}
