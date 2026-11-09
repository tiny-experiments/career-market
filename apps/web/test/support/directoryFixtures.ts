import type {
  CompanyDirectoryRow,
  CompanyPage,
  CompanySignalsOverview,
  JobListItem,
  SkillIndexRow,
  SkillPagePayload,
} from "@/lib/api";

const week = {
  range: "1W" as const,
  value: 0.05,
  baseDate: "2026-11-02",
  partial: false,
  estimated: false,
};
const month = { ...week, range: "1M" as const, value: 0.12 };

export function companyRow(
  overrides: Partial<CompanyDirectoryRow> = {},
): CompanyDirectoryRow {
  return {
    slug: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    open: 1240,
    rank: 12,
    change: week,
    change30d: month,
    spark: [1100, 1180, 1240],
    state: "RAMPING",
    topProfession: { family: "software", name: "Software" },
    remoteShare: 0.27,
    ...overrides,
  };
}

export const signalsOverview: CompanySignalsOverview = {
  counts: { RAMPING: 587, STEADY: 17136, COOLING: 299, FREEZING: 229 },
  ramping: [companyRow()],
  cooling: [
    companyRow({
      slug: "acme",
      name: "Acme",
      change: { ...week, value: -0.09 },
    }),
  ],
};

export const companyPayload: CompanyPage = {
  asOf: "2026-11-09",
  builtAt: "2026-11-09T06:00:00Z",
  company: {
    id: "co_stripe",
    slug: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    careersUrl: "https://stripe.com/jobs",
    open: 1240,
    rank: 12,
  },
  profiled: true,
  signal: {
    state: "RAMPING",
    windowDays: 6,
    windowFrom: "2026-11-03",
    partial: true,
    opened: 90,
    closed: 30,
    ratio: 3,
    change: month,
  },
  explainer: "Openings are growing faster than closures.",
  series: [
    {
      date: "2026-11-02",
      open: 900,
      opened: 0,
      closed: 0,
      excluded: true,
      boardChange: false,
    },
    {
      date: "2026-11-08",
      open: 1200,
      opened: 40,
      closed: 10,
      excluded: false,
      boardChange: false,
    },
    {
      date: "2026-11-09",
      open: 1240,
      opened: 50,
      closed: 10,
      excluded: false,
      boardChange: false,
    },
  ],
  firstObservedDay: "2026-11-02",
  flow: { opened: 90, closed: 30, windowDays: 6, since: "2026-11-03" },
  teams: [],
  profile: { available: false, reason: "Not profiled." },
  roleFilters: { professions: [], countries: [], remote: null },
  unclearOn: null,
  peers: { available: false, reason: "Not yet." },
  change7d: week,
  change30d: null,
  facets: {
    open: 1240,
    remoteShare: 0.27,
    families: [{ value: "software", label: "Software", count: 800 }],
    levels: [{ value: "mid", label: "Mid", count: 400 }],
    countries: [{ value: "GB", label: "UK", code: "GB", count: 300 }],
    workModes: [{ value: "remote", label: "Remote", count: 200 }],
    skills: [
      {
        value: "lang:go",
        label: "Go",
        count: 90,
        slug: "go",
        domain: "go.dev",
      },
      {
        value: "domain:payments",
        label: "Payments",
        count: 50,
        slug: null,
        domain: null,
      },
    ],
    medianDaysOpen: 38,
    pay: { roles: 400, low: 144000, median: 150000, high: 157000 },
  },
};

export const jobItem: JobListItem = {
  id: "kr_open12",
  title: "Staff Engineer",
  company: { id: "co_stripe", name: "Stripe", domain: "stripe.com" },
  location: "London",
  moreLocations: 0,
  workMode: "remote",
  level: "staff",
  family: "swe",
  familyName: "Software Engineering",
  salary: {
    min: 100000,
    max: 120000,
    currency: "USD",
    period: "year",
    annualMin: 100000,
    annualMax: 120000,
  },
  openedAt: "2026-11-08",
  ageDays: 1,
  repostCount: 0,
  href: "/jobs/kr_open12",
};

export function skillRow(
  overrides: Partial<SkillIndexRow> = {},
): SkillIndexRow {
  return {
    id: "lang:python",
    slug: "python",
    label: "Python",
    category: "Language",
    domain: "python.org",
    open: 93444,
    asOf: "2026-11-09",
    primaryName: "Software",
    primaryOpen: 37450,
    change: month,
    change7d: week,
    spark: [90000, 93444],
    remoteShare: 0.28,
    pay: { roles: 25266, low: 141000, median: 175000, high: 212000 },
    payEffect: 13500,
    topPair: {
      id: "cloud:aws",
      slug: "aws",
      label: "AWS",
      domain: "aws.amazon.com",
      share: 0.34,
    },
    ...overrides,
  };
}

export const skillPayload: SkillPagePayload = {
  asOf: "2026-11-09",
  stale: false,
  builtAt: "2026-11-09T06:00:00Z",
  id: "lang:python",
  slug: "python",
  label: "Python",
  category: "Language",
  domain: "python.org",
  primary: {
    family: "software",
    code: "SWE",
    name: "Software",
    open: 37450,
    familyOpen: 113000,
    share: 0.33,
  },
  totalOpen: 93444,
  change: month,
  series: [
    { date: "2026-11-08", open: 37000, estimated: false },
    { date: "2026-11-09", open: 37450, estimated: false },
  ],
  firstObservedDay: "2026-11-03",
  seriesNote: "Internal note that never shows.",
  peers: [
    {
      id: "lang:python",
      slug: "python",
      label: "Python",
      domain: "python.org",
      open: 37450,
      self: true,
    },
    {
      id: "lang:java",
      slug: "java",
      label: "Java",
      domain: "java.com",
      open: 26661,
      self: false,
    },
  ],
  professions: [
    {
      family: "software",
      code: "SWE",
      name: "Software",
      open: 37450,
      share: 0.4,
    },
  ],
  companies: [
    {
      id: "co_stripe",
      slug: "stripe",
      name: "Stripe",
      domain: "stripe.com",
      open: 200,
      change: null,
    },
  ],
  pairs: [
    {
      id: "cloud:aws",
      slug: "aws",
      label: "AWS",
      domain: "aws.amazon.com",
      open: 31485,
      share: 0.34,
      change: null,
    },
  ],
  salaryEffect: { available: false, reason: "Needs 50 roles." },
  latestRoles: [
    {
      id: "kr_open12",
      title: "Data Scientist",
      company: { id: "co_stripe", name: "Stripe", domain: "stripe.com" },
      location: "London",
      salary: null,
      openedOn: "2026-11-09",
      ageDays: 0,
    },
  ],
  change7d: week,
  rank: 1,
  remoteShare: 0.28,
  pay: { roles: 25266, low: 141000, median: 175000, high: 212000 },
};
