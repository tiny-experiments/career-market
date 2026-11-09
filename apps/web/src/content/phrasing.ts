/**
 * Comparisons, counts, labels and the job verdict, in words (UI-RULEBOOK.md
 * §9). A change is a number and the window it compares across, never a date.
 * Counts carry their noun. Links say where they go.
 */
import {
  direction,
  formatCount,
  formatDays,
  formatPercent,
  formatRelativeDays,
} from "@/lib/format";

/** The windows a change compares across. */
export type Window = "day" | "week" | "month" | "quarter" | "year";

/** The short column header for a window's change. */
export const WINDOW_HEADER: Record<Window, string> = {
  day: "24h",
  week: "7D",
  month: "30D",
  quarter: "3M",
  year: "1Y",
};

/** The comparison in words, as it follows a change: "▲ 1.3% this week". */
export const COMPARISON: Record<Window, string> = {
  day: "vs yesterday",
  week: "this week",
  month: "over 30 days",
  quarter: "over 3 months",
  year: "over a year",
};

/** The suffix `Delta` takes for a window. */
export function changeSuffix(window: Window): string {
  return COMPARISON[window];
}

/**
 * A change as a sentence fragment: "up 1.3% this week", "down 4.0% vs
 * yesterday", "unchanged over 30 days". For prose and accessible names; a cell
 * uses `Delta`.
 */
export function describeChange(ratio: number, window: Window): string {
  const tone = direction(ratio);
  if (tone === "flat") return `unchanged ${COMPARISON[window]}`;
  return `${tone} ${formatPercent(ratio)} ${COMPARISON[window]}`;
}

/** "unchanged this week" → "Unchanged this week", for the start of a line. */
export function sentence(fragment: string): string {
  return fragment.charAt(0).toUpperCase() + fragment.slice(1);
}

/** The words a change has while there is nothing to compare against yet. */
export const NOT_ENOUGH_HISTORY = "Not enough history yet";

/** The dash a paused or missing figure shows; the hover card explains it. */
export const NO_FIGURE = "—";

/** "1 role", "99,923 roles". */
export function countOf(n: number, singular: string, plural?: string): string {
  const noun = n === 1 ? singular : (plural ?? `${singular}s`);
  return `${formatCount(n)} ${noun}`;
}

/** "99,923 open roles". */
export function openRoles(n: number): string {
  return countOf(n, "open role");
}

/** "9,815 companies hiring". */
export function companiesHiring(n: number): string {
  return `${countOf(n, "company", "companies")} hiring`;
}

/** "8 of 3,223 open roles". */
export function showing(shown: number, total: number): string {
  return `${formatCount(shown)} of ${openRoles(total)}`;
}

/** "See all 99,923 jobs". */
export function seeAll(n: number, noun = "job"): string {
  return `See all ${countOf(n, noun)}`;
}

/** "See all jobs at Amazon". */
export function seeAllAt(company: string): string {
  return `See all jobs at ${company}`;
}

/** "sorted by open roles" — the small print beside a table's title. */
export function sortedBy(label: string): string {
  return `sorted by ${label.toLowerCase()}`;
}

/** What a posting leaves out: "No location stated." */
export function notStated(
  what: "location" | "seniority" | "work mode" | "pay",
): string {
  return `No ${what} stated.`;
}

/** Work mode as a word; null is said, never left blank. */
export const WORK_MODE_LABEL = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
} as const;

export type WorkMode = keyof typeof WORK_MODE_LABEL;

export function workModeLabel(mode: string | null | undefined): string {
  if (mode && mode in WORK_MODE_LABEL) {
    return WORK_MODE_LABEL[mode as WorkMode];
  }
  return "Not stated";
}

/** Seniority as a word, from the posting's level. */
export const LEVEL_LABEL = {
  intern: "Intern",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  staff: "Staff",
  principal: "Principal",
  manager: "Manager",
  director: "Director",
  executive: "Executive",
} as const;

export type Level = keyof typeof LEVEL_LABEL;

export function levelLabel(level: string | null | undefined): string {
  if (level && level in LEVEL_LABEL) return LEVEL_LABEL[level as Level];
  return "Not stated";
}

/** "Posted today", "Posted 3 days ago". */
export function postedAgo(days: number): string {
  return `Posted ${formatRelativeDays(days)}`;
}

/* ---------- The job verdict ---------- */

export type VerdictKind =
  "first-time" | "reposted" | "evergreen" | "closing-soon";

export const VERDICT_LABEL: Record<VerdictKind, string> = {
  "first-time": "First time posted",
  reposted: "Reposted",
  evergreen: "Likely evergreen",
  "closing-soon": "Closing soon",
};

/** The one sentence behind each verdict's badge. */
export const VERDICT_HINT: Record<VerdictKind, string> = {
  "first-time": "Posted once and never taken down and posted again.",
  reposted:
    "Taken down and posted again at least once, which often means the seat was not filled.",
  evergreen:
    "Up far longer than roles like it and reposted, which usually means a standing opening rather than one seat.",
  "closing-soon":
    "Up for about as long as roles like it usually stay open before they close.",
};

export interface VerdictFacts {
  readonly kind: VerdictKind;
  /** Days since the posting first went up. */
  readonly daysOpen: number;
  /** Times it was taken down and posted again. */
  readonly repostCount: number;
  /** How long roles like it typically stay open, when known. */
  readonly typicalDays?: number | null;
}

/**
 * The verdict's summary line: "Posted 12 days ago for the first time.
 * Roles like this are usually filled within 41 days."
 */
export function verdictSummary({
  kind,
  daysOpen,
  repostCount,
  typicalDays,
}: VerdictFacts): string {
  const ago = formatRelativeDays(daysOpen);
  const up = `up ${formatDays(daysOpen)}`;
  const typical =
    typicalDays === null || typicalDays === undefined
      ? ""
      : ` Roles like this are usually filled within ${formatDays(typicalDays)}.`;
  switch (kind) {
    case "first-time":
      return `Posted ${ago} for the first time.${typical}`;
    case "reposted":
      return `Posted ${formatCount(repostCount + 1)} times; this listing has been ${up}.${typical}`;
    case "evergreen":
      return `Up ${formatDays(daysOpen)} and posted ${formatCount(repostCount + 1)} times, which usually means a standing opening rather than one seat.`;
    case "closing-soon":
      return typicalDays === null || typicalDays === undefined
        ? `Up ${formatDays(daysOpen)}, about as long as roles like this usually stay open.`
        : `Up ${formatDays(daysOpen)}, close to the ${formatDays(typicalDays)} roles like this usually stay open.`;
  }
}

/** The facts under the verdict, as label and value pairs. */
export function verdictFacts({
  daysOpen,
  repostCount,
  typicalDays,
}: Omit<VerdictFacts, "kind">): readonly { label: string; value: string }[] {
  const facts = [
    { label: "Days open", value: formatDays(daysOpen) },
    {
      label: "Reposted",
      value: repostCount === 0 ? "Never" : `${formatCount(repostCount)}×`,
    },
  ];
  if (typicalDays !== null && typicalDays !== undefined) {
    facts.push({
      label: "Usually filled within",
      value: formatDays(typicalDays),
    });
  }
  return facts;
}

/** The one outbound link on the site. */
export const APPLY = "Apply on the employer's site";
