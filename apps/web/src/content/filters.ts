/**
 * The filters that sit on a table: what each choice is called and the one
 * line under the row that says what it shows. Labels say what the rows have
 * in common in plain words ("More roles than last week"), never a market
 * nickname on its own.
 */

export interface FilterCopy<T extends string> {
  readonly value: T;
  readonly label: string;
  /** One line under the filter row: what the table shows with this choice. */
  readonly description: string;
}

export const FILTER_LABEL = {
  professions: "Show professions",
  companies: "Show companies",
  skills: "Show skills",
  jobs: "Quick filters",
} as const;

export const PROFESSION_FILTERS = [
  {
    value: "overview",
    label: "All professions",
    description: "Every profession, most open roles first.",
  },
  {
    value: "gaining",
    label: "More roles than last week",
    description:
      "Professions with more open roles than a week ago, fastest growing first.",
  },
  {
    value: "cooling",
    label: "Fewer roles than last week",
    description:
      "Professions with fewer open roles than a week ago, fastest shrinking first.",
  },
  {
    value: "remote",
    label: "Remote-friendly",
    description: "Professions with the largest share of remote roles first.",
  },
  {
    value: "best-paid",
    label: "Best paid",
    description: "Professions with a pay range, highest paid first.",
  },
  {
    value: "new",
    label: "Most new roles this week",
    description:
      "Professions by how many roles were first posted in the last seven days.",
  },
] as const satisfies readonly FilterCopy<string>[];

export const COMPANY_FILTERS = [
  {
    value: "all",
    label: "All companies",
    description: "Every company with open tech roles, most open roles first.",
  },
  {
    value: "ramping",
    label: "Hiring more",
    description:
      "Ramping: companies clearly adding open roles over the last 30 days.",
  },
  {
    value: "steady",
    label: "Holding steady",
    description:
      "Steady: companies with about as many open roles as 30 days ago.",
  },
  {
    value: "cooling",
    label: "Hiring less",
    description: "Cooling: companies with fewer open roles than 30 days ago.",
  },
  {
    value: "freezing",
    label: "Hiring far less",
    description:
      "Freezing: companies with far fewer open roles than 30 days ago.",
  },
] as const satisfies readonly FilterCopy<string>[];

export const SKILL_FILTERS = [
  {
    value: "all",
    label: "All skills",
    description: "Every skill, named in the most open roles first.",
  },
  {
    value: "growing",
    label: "Fastest growing",
    description: "Skills whose open roles grew the most over 30 days.",
  },
  {
    value: "best-paid",
    label: "Highest paid",
    description: "Skills with listed pay, highest paid first.",
  },
  {
    value: "paired",
    label: "Most often paired",
    description: "Skills most often named in the same roles as another skill.",
  },
  {
    value: "remote",
    label: "Remote-friendly",
    description: "Skills with the largest share of remote roles first.",
  },
] as const satisfies readonly FilterCopy<string>[];

/** The Jobs table's one-click filters; each one is a filter in the rail too. */
export const JOB_QUICK_FILTERS = [
  { value: "today", label: "Posted today" },
  { value: "remote", label: "Remote" },
  { value: "pay", label: "Pay listed" },
] as const;
