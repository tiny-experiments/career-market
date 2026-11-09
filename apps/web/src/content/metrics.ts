/**
 * What each figure means, for the hover card behind it (UI-RULEBOOK.md §9).
 * One plain sentence about what the number is. Never how it is gathered,
 * where it comes from, how often it refreshes or how much history there is.
 * Never a formula.
 */

export interface MetricHint {
  /** The figure's name, as its label shows it. */
  readonly title: string;
  /** One sentence on what the number is. */
  readonly text: string;
}

export const METRICS = {
  // Headline and counts
  openRoles: {
    title: "Open roles",
    text: "Tech roles that are open right now.",
  },
  openRolesProfession: {
    title: "Open roles",
    text: "Roles in this profession that are open right now.",
  },
  openRolesCompany: {
    title: "Open roles",
    text: "Tech roles this company has open right now.",
  },
  openRolesSkill: {
    title: "Open roles",
    text: "Open roles that name this skill.",
  },
  newToday: { title: "New today", text: "Roles first posted today." },
  newLastDay: { title: "New today", text: "Roles posted in the last day." },
  remoteRoles: {
    title: "Remote roles",
    text: "Open roles that can be done from anywhere the employer hires.",
  },
  closedToday: { title: "Closed today", text: "Roles that closed today." },
  companiesHiring: {
    title: "Companies hiring",
    text: "Companies with at least one open role in this profession.",
  },
  rank: { title: "Rank", text: "Position by open roles, largest first." },
  newThisWeek: {
    title: "New this week",
    text: "Roles first posted in the last seven days.",
  },
  professionsGrowing: {
    title: "Professions growing",
    text: "How many professions have more open roles than a week ago.",
  },
  dailyFlow: {
    title: "Opened and closed",
    text: "Roles opened and roles closed each day this past week.",
  },
  specialties: {
    title: "Specialties",
    text: "The areas of this profession with the most open roles.",
  },
  skillShare: {
    title: "Share of roles",
    text: "The share of this profession's open roles that name the skill.",
  },
  skillChange: {
    title: "7-day change",
    text: "How much that share has grown or shrunk compared with a week ago.",
  },

  // Changes, one per window
  changeDay: {
    title: "24-hour change",
    text: "How much open roles have grown or shrunk compared with yesterday.",
  },
  changeWeek: {
    title: "7-day change",
    text: "How much open roles have grown or shrunk compared with a week ago.",
  },
  changeMonth: {
    title: "30-day change",
    text: "How much open roles have grown or shrunk compared with 30 days ago.",
  },
  changeQuarter: {
    title: "3-month change",
    text: "How much open roles have grown or shrunk compared with three months ago.",
  },
  changeYear: {
    title: "1-year change",
    text: "How much open roles have grown or shrunk compared with a year ago.",
  },
  changePending: {
    title: "Change",
    text: "Shows once there is a full week to compare against.",
  },
  changePaused: {
    title: "Change paused",
    text: "This company's listings moved too much in one day to read as hiring, so its change is paused.",
  },
  trend: { title: "Trend", text: "Open roles over the last 30 days." },

  // Company signal
  signal: {
    title: "Hiring signal",
    text: "Where a company's open roles went over the last 30 days, read with its openings and closings.",
  },
  openings: {
    title: "Openings",
    text: "Roles that opened in the window.",
  },
  closings: { title: "Closings", text: "Roles that closed in the window." },
  flow: {
    title: "Openings and closings",
    text: "Roles opened and roles closed, week by week.",
  },

  // Time
  typicalTimeOpen: {
    title: "Typical time open",
    text: "Half of the open roles have been up for less than this.",
  },
  daysOpen: {
    title: "Days open",
    text: "Days since this role was first posted.",
  },
  reposts: {
    title: "Reposted",
    text: "How many times this role has been taken down and posted again.",
  },
  typicalWindow: {
    title: "Usually filled within",
    text: "How long roles like this one typically stay open before they close.",
  },

  // Pay
  payRange: {
    title: "Pay range",
    text: "The middle half of the pay listed on recent senior roles in the United States.",
  },
  payVersusRange: {
    title: "Pay versus the market",
    text: "Where this role's listed pay sits against the range for similar roles.",
  },
  listedPay: {
    title: "Listed pay",
    text: "The pay stated in the posting.",
  },

  // Shares
  workMode: {
    title: "Work mode",
    text: "Shares of the roles that state a work mode: remote, hybrid or on-site.",
  },
  remoteShare: {
    title: "Remote share",
    text: "The share of roles that are remote, among those that state a work mode.",
  },
  share: {
    title: "Share",
    text: "This slice's share of the profession's open roles.",
  },
  seniority: {
    title: "Seniority",
    text: "Shares of roles by the level the posting names.",
  },
  countries: {
    title: "Where",
    text: "Open roles by the country the posting names.",
  },

  // Skills
  skillsInDemand: {
    title: "Skills in demand",
    text: "Skills named in the most open roles; the change compares this week's share of roles with last week's.",
  },
  skillsInPosting: {
    title: "Skills in this posting",
    text: "Named in the posting text, most mentioned first.",
  },
  pairedSkills: {
    title: "Paired with",
    text: "Skills most often named in the same postings as this one.",
  },
  skillProfessions: {
    title: "Professions",
    text: "The professions whose open roles name this skill, and the share of each that does.",
  },

  // Companies and skills
  topProfession: {
    title: "Top profession",
    text: "The profession with the most of this company's open roles.",
  },
  companyPay: {
    title: "Pay range",
    text: "The middle half of the pay this company lists, in US dollars.",
  },
  skillPay: {
    title: "Typical pay",
    text: "The middle of the pay listed on roles that name this skill, in US dollars.",
  },
  skillPayRange: {
    title: "Pay range",
    text: "The middle half of the pay listed on roles that name this skill, in US dollars.",
  },
  payLift: {
    title: "Pay lift",
    text: "How much more roles naming this skill list than similar roles that don't.",
  },
  pairedShare: {
    title: "Paired with",
    text: "The skill most often named alongside this one, and the share of its roles that name both.",
  },
  professionShare: {
    title: "Share of profession",
    text: "The share of this profession's open roles that name this skill.",
  },
  hiringSignals: {
    title: "Hiring signals",
    text: "How companies are moving: ramping means clearly more openings than closings, cooling and freezing the reverse.",
  },
  peers: {
    title: "Compared with",
    text: "Open roles naming this skill beside the closest alternatives in the same profession.",
  },
  skillChart: {
    title: "Open roles",
    text: "Open roles naming this skill in its largest profession.",
  },
} as const satisfies Record<string, MetricHint>;

export type MetricKey = keyof typeof METRICS;

/** The hint for a figure, in the shape `MetricHoverCard`, `StatCard`, `KpiTile` and `Column.hint` take. */
export function metricHint(key: MetricKey): MetricHint {
  return METRICS[key];
}

/** A company's signal in a word, with the one sentence behind it. Sentence case, never a bare dot. */
export const SIGNALS = {
  RAMPING: {
    label: "Ramping",
    text: "Open roles up 5% or more in 30 days, with clearly more openings than closings.",
  },
  STEADY: {
    label: "Steady",
    text: "Open roles roughly where they were 30 days ago.",
  },
  COOLING: {
    label: "Cooling",
    text: "Open roles down 3% or more in 30 days, with more closings than openings.",
  },
  FREEZING: {
    label: "Freezing",
    text: "Open roles down 10% or more in 30 days, with far more closings than openings.",
  },
} as const;

export type SignalState = keyof typeof SIGNALS;
