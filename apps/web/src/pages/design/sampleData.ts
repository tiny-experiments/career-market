import type { Signal } from "@/components/data";
import type { SearchGroup, TickerItem } from "@/components/layout";

/** Realistic figures for the design page, in the shape the pages will use. */

export interface ProfessionRow {
  readonly code: string;
  readonly name: string;
  readonly openRoles: number;
  readonly change1d: number;
  readonly change7d: number;
  readonly change30d: number;
  readonly companies: number;
  readonly payLow: number;
  readonly payHigh: number;
  readonly remoteShare: number;
  readonly trend: readonly number[];
}

const trend = (start: number, end: number, wobble: number): number[] =>
  Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    const wave =
      Math.sin(i * 0.9) * wobble * 0.45 + Math.cos(i * 0.35) * wobble * 0.3;
    return Math.round(start + (end - start) * t + wave);
  });

export const PROFESSIONS: readonly ProfessionRow[] = [
  {
    code: "SWE",
    name: "Software",
    openRoles: 99_923,
    change1d: 0.004,
    change7d: 0.037,
    change30d: 0.151,
    companies: 9_815,
    payLow: 144_000,
    payHigh: 157_000,
    remoteShare: 0.27,
    trend: trend(86_800, 99_923, 900),
  },
  {
    code: "AIML",
    name: "AI & ML",
    openRoles: 11_061,
    change1d: -0.002,
    change7d: -0.007,
    change30d: 0.089,
    companies: 3_102,
    payLow: 170_000,
    payHigh: 215_000,
    remoteShare: 0.31,
    trend: trend(10_160, 11_061, 260),
  },
  {
    code: "DATA",
    name: "Data",
    openRoles: 19_360,
    change1d: 0.001,
    change7d: -0.022,
    change30d: 0.04,
    companies: 5_230,
    payLow: 135_000,
    payHigh: 168_000,
    remoteShare: 0.22,
    trend: trend(19_900, 19_360, 300),
  },
  {
    code: "INFRA",
    name: "Platform & Infra",
    openRoles: 16_160,
    change1d: 0.006,
    change7d: 0.046,
    change30d: 0.112,
    companies: 4_410,
    payLow: 150_000,
    payHigh: 190_000,
    remoteShare: 0.35,
    trend: trend(14_530, 16_160, 320),
  },
  {
    code: "WEB",
    name: "Web & Mobile",
    openRoles: 12_414,
    change1d: 0.011,
    change7d: 0.127,
    change30d: 0.183,
    companies: 3_870,
    payLow: 120_000,
    payHigh: 160_000,
    remoteShare: 0.29,
    trend: trend(10_490, 12_414, 280),
  },
  {
    code: "QA",
    name: "QA & Testing",
    openRoles: 13_987,
    change1d: -0.004,
    change7d: -0.049,
    change30d: -0.021,
    companies: 3_640,
    payLow: 95_000,
    payHigh: 130_000,
    remoteShare: 0.18,
    trend: trend(14_700, 13_987, 240),
  },
  {
    code: "SEC",
    name: "Security",
    openRoles: 8_412,
    change1d: 0.002,
    change7d: 0.015,
    change30d: 0.061,
    companies: 2_980,
    payLow: 150_000,
    payHigh: 195_000,
    remoteShare: 0.33,
    trend: trend(7_930, 8_412, 180),
  },
  {
    code: "ENT",
    name: "Enterprise Apps",
    openRoles: 2_875,
    change1d: 0.0,
    change7d: 0.037,
    change30d: 0.052,
    companies: 1_210,
    payLow: 110_000,
    payHigh: 145_000,
    remoteShare: 0.14,
    trend: trend(2_730, 2_875, 90),
  },
];

export interface CompanyRow {
  readonly slug: string;
  readonly name: string;
  readonly domain: string | null;
  readonly openRoles: number;
  readonly change7d: number;
  readonly change30d: number;
  readonly signal: Signal;
  readonly topProfession: string;
  readonly topProfessionRoles: number;
  readonly remoteShare: number;
  readonly trend: readonly number[];
}

export const COMPANIES: readonly CompanyRow[] = [
  {
    slug: "amazon",
    name: "Amazon",
    domain: "amazon.com",
    openRoles: 6_950,
    change7d: 0.062,
    change30d: 0.09,
    signal: "ramping",
    topProfession: "Software",
    topProfessionRoles: 3_223,
    remoteShare: 0.08,
    trend: trend(6_380, 6_950, 120),
  },
  {
    slug: "apple",
    name: "Apple",
    domain: "apple.com",
    openRoles: 3_257,
    change7d: 0.051,
    change30d: 0.038,
    signal: "steady",
    topProfession: "Software",
    topProfessionRoles: 1_152,
    remoteShare: 0.02,
    trend: trend(3_140, 3_257, 60),
  },
  {
    slug: "nvidia",
    name: "NVIDIA",
    domain: "nvidia.com",
    openRoles: 1_207,
    change7d: 0.086,
    change30d: 0.214,
    signal: "ramping",
    topProfession: "AI & ML",
    topProfessionRoles: 410,
    remoteShare: 0.19,
    trend: trend(990, 1_207, 40),
  },
  {
    slug: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    openRoles: 412,
    change7d: 0.024,
    change30d: 0.071,
    signal: "steady",
    topProfession: "Software",
    topProfessionRoles: 231,
    remoteShare: 0.46,
    trend: trend(385, 412, 14),
  },
  {
    slug: "accenture",
    name: "Accenture",
    domain: "accenture.com",
    openRoles: 5_118,
    change7d: -0.031,
    change30d: -0.082,
    signal: "cooling",
    topProfession: "Enterprise Apps",
    topProfessionRoles: 1_904,
    remoteShare: 0.11,
    trend: trend(5_570, 5_118, 110),
  },
  {
    slug: "wipro",
    name: "Wipro",
    domain: "wipro.com",
    openRoles: 1_644,
    change7d: -0.118,
    change30d: -0.236,
    signal: "freezing",
    topProfession: "QA & Testing",
    topProfessionRoles: 512,
    remoteShare: 0.05,
    trend: trend(2_150, 1_644, 70),
  },
  {
    slug: "citi",
    name: "Citi",
    domain: "citi.com",
    openRoles: 964,
    change7d: 0.116,
    change30d: 0.142,
    signal: "ramping",
    topProfession: "Software",
    topProfessionRoles: 388,
    remoteShare: 0.07,
    trend: trend(845, 964, 30),
  },
  {
    slug: "genpact",
    name: "Genpact",
    domain: "genpact.com",
    openRoles: 316,
    change7d: 0.109,
    change30d: 0.05,
    signal: "ramping",
    topProfession: "Data",
    topProfessionRoles: 121,
    remoteShare: 0.12,
    trend: trend(285, 316, 12),
  },
];

export const SKILLS_RISING = [
  { slug: "python", name: "Python", openRoles: 83_626, change7d: 0.021 },
  {
    slug: "kubernetes",
    name: "Kubernetes",
    openRoles: 32_251,
    change7d: 0.018,
  },
  { slug: "llms", name: "LLMs", openRoles: 28_951, change7d: 0.064 },
  {
    slug: "typescript",
    name: "TypeScript",
    openRoles: 41_370,
    change7d: 0.012,
  },
  { slug: "rust", name: "Rust", openRoles: 6_204, change7d: 0.043 },
] as const;

export const SPECIALTIES = [
  { name: "Backend", openRoles: 15_140, change7d: 0.041 },
  { name: "Full-stack", openRoles: 11_108, change7d: 0.029 },
  { name: "Systems", openRoles: 7_363, change7d: -0.008 },
  { name: "Mobile", openRoles: 5_220, change7d: 0.012 },
  { name: "Embedded", openRoles: 3_980, change7d: -0.003 },
] as const;

export const SENIORITY = [
  { label: "Senior", share: 0.42, swatch: "bg-chart-1" },
  { label: "Staff", share: 0.19, swatch: "bg-chart-2" },
  { label: "Mid", share: 0.16, swatch: "bg-chart-3" },
  { label: "Principal", share: 0.09, swatch: "bg-chart-4" },
  { label: "Other", share: 0.14, swatch: "bg-chart-5" },
] as const;

export const WHERE = [
  { name: "United States", openRoles: 42_877 },
  { name: "India", openRoles: 15_817 },
  { name: "United Kingdom", openRoles: 3_814 },
  { name: "Germany", openRoles: 2_906 },
  { name: "Canada", openRoles: 2_511 },
] as const;

/** Ninety days of open Software roles, the first sixty estimated. */
export const SWE_SERIES = Array.from({ length: 90 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 7, 10 + i));
  const t = i / 89;
  const value = Math.round(83_000 + 16_923 * t * t + Math.sin(i / 3) * 700);
  return { date: date.toISOString().slice(0, 10), value };
});
export const SWE_ESTIMATED_UNTIL = 60;

export const TICKER: readonly TickerItem[] = [
  { label: "Open roles", value: "262,845", change: 0.013, to: "/" },
  { label: "New today", value: "661", change: 0.12, to: "/?view=new" },
  { label: "Closed today", value: "3,913", change: -0.04 },
  { label: "Software", value: "99,923", change: 0.037, to: "/professions/swe" },
  {
    label: "AI & ML",
    value: "11,061",
    change: -0.007,
    to: "/professions/aiml",
  },
  {
    label: "Platform & Infra",
    value: "16,160",
    change: 0.046,
    to: "/professions/infra",
  },
  { label: "Remote share", value: "27%" },
  { label: "Median pay, US senior", value: "$152K" },
];

export const SEARCH_GROUPS: readonly SearchGroup[] = [
  {
    heading: "Professions",
    items: [
      { id: "swe", label: "Software", hint: "SWE", to: "/professions/swe" },
      {
        id: "infra",
        label: "Platform & Infra",
        hint: "INFRA",
        to: "/professions/infra",
      },
    ],
  },
  {
    heading: "Companies",
    items: [
      {
        id: "stripe",
        label: "Stripe",
        hint: "stripe.com",
        to: "/companies/stripe",
      },
      {
        id: "nvidia",
        label: "NVIDIA",
        hint: "nvidia.com",
        to: "/companies/nvidia",
      },
    ],
  },
  {
    heading: "Skills",
    items: [
      {
        id: "python",
        label: "Python",
        hint: "83,626 roles",
        to: "/skills/python",
      },
    ],
  },
  {
    heading: "Jobs",
    items: [
      {
        id: "job-1",
        label: "Senior Backend Engineer",
        hint: "Stripe · Remote, US",
        to: "/jobs/1",
      },
    ],
  },
];
