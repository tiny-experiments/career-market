/**
 * Formatters for every figure on the site (UI-RULEBOOK.md §9). Never format
 * inline: a number reads the same in a tile, a table cell and a hover card.
 */

const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const share = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 99923 → "99,923". Whole figures, every digit: this is a market, not a dashboard. */
export function formatCount(value: number): string {
  return count.format(value);
}

/** 0.037 → "3.7%". The sign belongs to `Delta`, not to the number. */
export function formatPercent(ratio: number): string {
  return `${percent.format(Math.abs(ratio) * 100)}%`;
}

/** 0.27 → "27%", for shares of a whole (remote share, a level's slice). */
export function formatShare(ratio: number): string {
  return `${share.format(ratio * 100)}%`;
}

/** 144000 → "$144K"; 1250000 → "$1.25M". Pay is always USD here. */
export function formatPay(amount: number): string {
  if (Math.round(amount / 1000) >= 1000) {
    const millions = amount / 1_000_000;
    return `$${millions.toFixed(millions >= 10 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  }
  return `$${Math.round(amount / 1000)}K`;
}

/** (144000, 157000) → "$144K–$157K". One figure when both ends meet. */
export function formatPayRange(low: number, high: number): string {
  const a = formatPay(low);
  const b = formatPay(high);
  return a === b ? a : `${a}–${b}`;
}

/** 38 → "38 days"; 1 → "1 day". */
export function formatDays(days: number): string {
  const whole = Math.round(days);
  return `${count.format(whole)} ${whole === 1 ? "day" : "days"}`;
}

/** "Software" + "Platform & Infra" → "S", "PI": the monogram behind a missing logo. */
export function monogram(name: string): string {
  const words = name
    .split(/[\s&/,-]+/)
    .filter((word) => /^[A-Za-z0-9]/.test(word));
  const first = words[0]?.[0] ?? name[0] ?? "?";
  const second = words.length > 1 ? (words[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

export type Direction = "up" | "down" | "flat";

/** The direction a change reads as; changes under half a tenth of a percent are flat. */
export function direction(ratio: number): Direction {
  if (ratio > 0.0005) return "up";
  if (ratio < -0.0005) return "down";
  return "flat";
}

/* ---------- Time ---------- */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2026-11-09" → "9 Nov 2026". A date is a fact about a posting, never a qualifier on a change. */
export function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  const name = month === undefined ? undefined : MONTHS[month - 1];
  if (!year || !day || !name) return isoDay;
  return `${day} ${name} ${year}`;
}

/** 0 → "today", 1 → "yesterday", 3 → "3 days ago", 10 → "a week ago", 40 → "a month ago", 400 → "a year ago". */
export function formatRelativeDays(days: number): string {
  const whole = Math.max(0, Math.round(days));
  if (whole === 0) return "today";
  if (whole === 1) return "yesterday";
  if (whole < 7) return `${whole} days ago`;
  if (whole < 30) {
    const weeks = Math.round(whole / 7);
    return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
  }
  if (whole < 365) {
    const months = Math.max(1, Math.round(whole / 30));
    return months === 1 ? "a month ago" : `${months} months ago`;
  }
  const years = Math.max(1, Math.round(whole / 365));
  return years === 1 ? "a year ago" : `${years} years ago`;
}

/** The whole days from `isoDay` to `today` (default: now, in UTC). Never negative. */
export function daysSince(isoDay: string, today: Date = new Date()): number {
  const then = Date.parse(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(then)) return 0;
  const now = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

/** "2026-11-06" → "3 days ago" on 9 Nov 2026. */
export function formatRelativeDay(isoDay: string, today?: Date): string {
  return formatRelativeDays(daysSince(isoDay, today));
}

/* ---------- Money ---------- */

const SYMBOLS: Readonly<Record<string, string>> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** "USD" → "$", "EUR" → "€", "GBP" → "£"; every other code stays a code with a space ("CAD "). */
function currencySymbol(currency: string): string {
  const code = currency.toUpperCase();
  return SYMBOLS[code] ?? `${code} `;
}

/** 144000 → "$144K"; (80000, "EUR") → "€80K". The same shape as `formatPay`, in any currency. */
export function formatMoney(amount: number, currency = "USD"): string {
  return `${currencySymbol(currency)}${formatPay(amount).slice(1)}`;
}

/** (144000, 157000, "GBP") → "£144K–£157K". */
export function formatMoneyRange(
  low: number,
  high: number,
  currency = "USD",
): string {
  const a = formatMoney(low, currency);
  const b = formatMoney(high, currency);
  return a === b ? a : `${a}–${b}`;
}

/** 45 → "$45"; 45.5 → "$45.50": the exact figure, for hourly and daily rates. */
function formatExact(amount: number, currency: string): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  return `${currencySymbol(currency)}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)}`;
}

export interface ListedPay {
  readonly min: number | null;
  readonly max: number | null;
  readonly currency: string | null;
  /** "year", "month", "week", "day", "hour", or whatever the posting said. */
  readonly period: string | null;
  readonly annualMin?: number | null;
  readonly annualMax?: number | null;
}

const PERIOD_WORD: Record<string, string> = {
  hour: "an hour",
  hourly: "an hour",
  day: "a day",
  daily: "a day",
  week: "a week",
  weekly: "a week",
  month: "a month",
  monthly: "a month",
};

const YEARLY_PERIODS: ReadonlySet<string> = new Set([
  "year",
  "yearly",
  "annual",
  "annually",
  "per year",
  "p.a.",
]);

/** Below this a stated figure with no known period is a rate, not a salary. */
const YEARLY_FLOOR = 10_000;

/**
 * The pay a posting states, as one phrase: "$144K–$157K" for a yearly figure,
 * "$45–$60 an hour" for a rate, null when it states none. Listed pay only.
 */
export function formatListedPay(
  pay: ListedPay | null | undefined,
): string | null {
  if (!pay) return null;
  const currency = pay.currency ?? "USD";
  const annualLow = pay.annualMin ?? null;
  const annualHigh = pay.annualMax ?? null;
  if (annualLow !== null || annualHigh !== null) {
    const low = annualLow ?? annualHigh;
    const high = annualHigh ?? annualLow;
    if (low !== null && high !== null) {
      return formatMoneyRange(low, high, currency);
    }
  }
  const low = pay.min ?? pay.max;
  const high = pay.max ?? pay.min;
  if (
    low === null ||
    high === null ||
    low === undefined ||
    high === undefined
  ) {
    return null;
  }
  const period = pay.period?.trim().toLowerCase() ?? "";
  const word = PERIOD_WORD[period];
  if (
    word === undefined &&
    (YEARLY_PERIODS.has(period) || Math.min(low, high) >= YEARLY_FLOOR)
  ) {
    return formatMoneyRange(low, high, currency);
  }
  const a = formatExact(low, currency);
  const b = formatExact(high, currency);
  const range = a === b ? a : `${a}–${b}`;
  return word === undefined ? range : `${range} ${word}`;
}
