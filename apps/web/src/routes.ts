import type { ComponentType } from "react";
import type { Params } from "react-router";
import { PAGES, type PageKey } from "@/content";
import {
  companiesList,
  companyDetail,
  companyJobs,
  companySignals,
  jobDetail,
  jobFacets,
  jobsList,
  jobsPulse,
  marketOverview,
  professionDetail,
  professionsIndex,
  SEARCH_MIN_LENGTH,
  siteMeta,
  siteSearch,
  skillDetail,
  skillsIndex,
  type Resource,
} from "@/lib/api";
import {
  companiesFiltersFrom,
  jobsFiltersFrom,
  LIST_PAGE_SIZE,
  pageFrom,
} from "@/lib/listFilters";
import { professionRegionFrom } from "@/lib/professions";
import type { RouteHandle } from "@/lib/nav";

export interface PageRouteMatch {
  readonly params: Params;
  readonly search: URLSearchParams;
}

export interface PageRoute {
  /** The address, absolute: this table is matched against links too. */
  readonly path: string;
  readonly handle: RouteHandle;
  readonly page: () => Promise<{ Component: ComponentType }>;
  /** What the page reads, started alongside its chunk so neither waits. */
  readonly data?: (match: PageRouteMatch) => readonly Resource<unknown>[];
}

/** How many results each kind shows on the full search page. */
export const SEARCH_PAGE_LIMIT = 10;

/** How many of a company's roles its page shows before "see all". */
export const COMPANY_JOBS_PREVIEW = 25;

const handleFor = (key: PageKey): RouteHandle => ({
  title: PAGES[key].title,
  meta: PAGES[key].meta,
});

/**
 * Every page a visitor can reach: address, chrome, chunk and the data behind
 * it. The router is built from this, and so is hover prefetching, so the two
 * can never disagree about what a link will need.
 */
export const pageRoutes: readonly PageRoute[] = [
  {
    path: "/",
    handle: handleFor("market"),
    page: () =>
      import("@/pages/MarketPage").then((m) => ({ Component: m.MarketPage })),
    // The site's day dates the trend lines.
    data: () => [marketOverview(), professionsIndex(), siteMeta()],
  },
  {
    path: "/professions",
    handle: handleFor("professions"),
    page: () =>
      import("@/pages/ProfessionsPage").then((m) => ({
        Component: m.ProfessionsPage,
      })),
    data: ({ search }) => [
      professionsIndex(professionRegionFrom(search)),
      siteMeta(),
    ],
  },
  {
    path: "/professions/:code",
    handle: handleFor("profession"),
    page: () =>
      import("@/pages/ProfessionPage").then((m) => ({
        Component: m.ProfessionPage,
      })),
    data: ({ params }) => [professionDetail(params["code"] ?? "")],
  },
  {
    path: "/companies",
    handle: handleFor("companies"),
    page: () =>
      import("@/pages/CompaniesPage").then((m) => ({
        Component: m.CompaniesPage,
      })),
    data: ({ search }) => [
      companiesList({
        ...companiesFiltersFrom(search),
        page: pageFrom(search),
        pageSize: LIST_PAGE_SIZE,
      }),
      companySignals(),
      siteMeta(),
    ],
  },
  {
    path: "/companies/:slug",
    handle: handleFor("company"),
    page: () =>
      import("@/pages/CompanyPage").then((m) => ({
        Component: m.CompanyPage,
      })),
    data: ({ params }) => {
      const slug = params["slug"] ?? "";
      return [
        companyDetail(slug),
        companyJobs(slug, { page: 1, pageSize: COMPANY_JOBS_PREVIEW }),
      ];
    },
  },
  {
    path: "/skills",
    handle: handleFor("skills"),
    page: () =>
      import("@/pages/SkillsPage").then((m) => ({ Component: m.SkillsPage })),
    data: () => [skillsIndex()],
  },
  {
    path: "/skills/:slug",
    handle: handleFor("skill"),
    page: () =>
      import("@/pages/SkillPage").then((m) => ({ Component: m.SkillPage })),
    data: ({ params }) => [skillDetail(params["slug"] ?? "")],
  },
  {
    path: "/jobs",
    handle: handleFor("jobs"),
    page: () =>
      import("@/pages/JobsPage").then((m) => ({ Component: m.JobsPage })),
    data: ({ search }) => [
      jobsList({
        ...jobsFiltersFrom(search),
        page: pageFrom(search),
        pageSize: LIST_PAGE_SIZE,
      }),
      jobsPulse(),
      jobFacets(),
      siteMeta(),
    ],
  },
  {
    path: "/jobs/:id",
    handle: handleFor("job"),
    page: () =>
      import("@/pages/JobPage").then((m) => ({ Component: m.JobPage })),
    data: ({ params }) => [jobDetail(params["id"] ?? "")],
  },
  {
    path: "/search",
    handle: handleFor("search"),
    page: () =>
      import("@/pages/SearchPage").then((m) => ({ Component: m.SearchPage })),
    data: ({ search }) => {
      const q = search.get("q")?.trim() ?? "";
      return q.length >= SEARCH_MIN_LENGTH
        ? [siteSearch(q, SEARCH_PAGE_LIMIT)]
        : [];
    },
  },
  {
    path: "/about",
    handle: handleFor("about"),
    page: () =>
      import("@/pages/AboutPage").then((m) => ({ Component: m.AboutPage })),
  },
];
