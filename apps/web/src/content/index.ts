/**
 * Every customer-facing sentence in the app, in one place (UI-RULEBOOK.md
 * §9). Pages and components import words from here and never write them
 * inline, so the voice stays one voice and `check:ui` can hold it to the
 * rules: no provider, no method, no dates as qualifiers, no company totals.
 */
export {
  DIRECTORY_COPY,
  lastDays,
  latestJobsNaming,
  openRolesAt,
  openRolesAtOverTime,
  openRolesNamingOverTime,
  rankByOpenRoles,
  shareOf,
} from "./directories";
export {
  JOBS_LIST,
  JOB_PAGE,
  PAY_POSITION,
  SEARCH_PAGE,
  applyAt,
  closedDetail,
  jobsFound,
  repostedTimes,
  seeOpenRoles,
  usualWindow,
  verdictDetail,
  verdictHeadline,
  type JobVerdict,
} from "./jobs";
export {
  METRICS,
  SIGNALS,
  metricHint,
  type MetricHint,
  type MetricKey,
  type SignalState,
} from "./metrics";
export { MARKET_COPY, professionsGrowing } from "./market";
export {
  APPLY,
  COMPARISON,
  LEVEL_LABEL,
  NOT_ENOUGH_HISTORY,
  NO_FIGURE,
  VERDICT_HINT,
  VERDICT_LABEL,
  WINDOW_HEADER,
  WORK_MODE_LABEL,
  changeSuffix,
  companiesHiring,
  countOf,
  describeChange,
  levelLabel,
  notStated,
  openRoles,
  postedAgo,
  seeAll,
  seeAllAt,
  sentence,
  showing,
  sortedBy,
  verdictFacts,
  verdictSummary,
  workModeLabel,
  type Level,
  type VerdictFacts,
  type VerdictKind,
  type Window,
  type WorkMode,
} from "./phrasing";
export {
  ABOUT,
  FOOTER_LINE,
  PAGES,
  SITE_NAME,
  companyPage,
  documentTitle,
  jobPage,
  professionPage,
  skillPage,
  type PageCopy,
  type PageKey,
} from "./site";
export {
  BACK_TO_MARKET,
  EMPTY,
  ERROR,
  ERROR_DETAIL,
  TRY_AGAIN,
  couldNotLoad,
  nothingFound,
  type EmptyKey,
  type ErrorKey,
  type StateCopy,
} from "./states";
