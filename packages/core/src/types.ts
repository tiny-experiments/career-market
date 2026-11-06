/**
 * Payloads the read API serves and the web app renders. Plain JSON: numbers,
 * strings, ISO days. No krill field leaks through unparsed.
 */
import type { CompanyMover } from './company.ts';
import type { IsoDay, Range } from './dates.ts';

export interface Change {
  range: Range;
  /** Fraction: 0.021 = +2.1%. */
  value: number;
  baseDate: IsoDay;
  /** The range reaches before the first comparable day; the change covers baseDate..asOf only. */
  partial: boolean;
  /** The base value comes from the back-cast. */
  estimated: boolean;
}

export interface TickerItem {
  code: string;
  name: string;
  href: string | null;
  open: number;
  /** null: no change available yet (reason in `note`). */
  change: Change | null;
  note?: string;
}

/** Everything every page shows: ticker tape, "Data as of", footer. */
export interface ChromePayload {
  asOf: IsoDay | null;
  builtAt: string | null;
  boards: number | null;
  ticker: TickerItem[];
}

export interface SeriesPoint {
  date: IsoDay;
  /** Open roles on today's boards (chain-linked); estimated before the first observed day. */
  open: number;
  /** Jobs opened that day (posted day, else first seen). */
  new: number;
  /** Closings detected that day. */
  closed: number;
  estimated: boolean;
  /** krill bootstrap day: excluded from change numbers. */
  bootstrap: boolean;
}

export interface ProfessionMover {
  family: string;
  code: string;
  name: string;
  open: number;
  change: Change | null;
  spark: number[];
}

export interface SkillTile {
  id: string;
  label: string;
  open: number;
  change: Change | null;
  spark: number[];
}

export interface CountryRow {
  code: string;
  name: string;
  open: number;
  /** open / all open tech roles. */
  share: number;
}

export interface MarketNote {
  rule: string;
  text: string;
}

export interface Unavailable {
  available: false;
  /** Plain-language reason shown in the widget. */
  reason: string;
}

export interface MarketOverview {
  asOf: IsoDay;
  builtAt: string;
  headline: {
    open: number;
    change: Change | null;
  };
  /** Daily series, oldest first; estimated days first, then observed days. */
  series: SeriesPoint[];
  firstObservedDay: IsoDay;
  backcast: {
    available: boolean;
    note: string;
  };
  stats: {
    companies: number | null;
    newToday: number;
    closedToday: number;
    medianDaysOpen: number | null;
  };
  professionsGaining: ProfessionMover[];
  /** Companies with the largest one-week gain; an honest empty state until a week of company history exists. */
  companiesRamping: { available: true; rows: CompanyMover[] } | Unavailable;
  biggestFreezes: Unavailable;
  hottestSkills: SkillTile[];
  /** Ranked countries (first located country of each job), largest first. */
  countries: CountryRow[];
  totalOpen: number;
  notes: MarketNote[];
}
