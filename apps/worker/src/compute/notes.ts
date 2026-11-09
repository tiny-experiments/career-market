import { countryName } from '@cm/core/codes';
import { formatDayShort, type IsoDay } from '@cm/core/dates';
import type { Change } from '@cm/core/types';

/** Rule-written market notes. Plain rules over the day's numbers; no LLM. */

export interface NoteInput {
  asOf: IsoDay;
  open: number;
  marketChange: Change | null;
  /** Families ranked by 1W change, best first (already filtered to meaningful size). */
  families: { code: string; name: string; open: number; change: Change | null }[];
  /** Open jobs per level on asOf ('' = unknown level). */
  levels: Map<string, number>;
  /** Open jobs per first located country on asOf ('' = not located). */
  countries: Map<string, number>;
  /** Opened and closed jobs over the comparable observed days of the last week. */
  flow: { opened: number; closed: number; since: IsoDay } | null;
}

export interface Note {
  rule: string;
  text: string;
  numbers: Record<string, number | string>;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtPct = (f: number) => `${(Math.abs(f) * 100).toFixed(1)}%`;
const direction = (f: number) => (f >= 0 ? 'up' : 'down');

/** "this week", "this week (estimated)" or "since 3 Nov". */
export function windowLabel(change: Change): string {
  if (change.partial) return `since ${formatDayShort(change.baseDate)}`;
  const base = change.range === '1W' ? 'this week' : `over ${change.range}`;
  return change.estimated ? `${base} (estimated)` : base;
}

const RULES: ((input: NoteInput) => Note | null)[] = [
  function momentum({ open, marketChange }) {
    if (!marketChange) return null;
    return {
      rule: 'momentum',
      text: `Hiring momentum ${direction(marketChange.value)} ${fmtPct(marketChange.value)} ${windowLabel(marketChange)}, with ${fmtInt(open)} open roles.`,
      numbers: { change: marketChange.value, open, baseDate: marketChange.baseDate },
    };
  },
  function leaders({ families }) {
    const [a, b] = families.filter((f) => f.change !== null);
    if (!a?.change || !b?.change) return null;
    const verb = a.change.value >= 0 && b.change.value >= 0 ? 'lead, up' : 'lead the table at';
    const values =
      verb === 'lead, up'
        ? `${fmtPct(a.change.value)} and ${fmtPct(b.change.value)}`
        : `${signed(a.change.value)} and ${signed(b.change.value)}`;
    return {
      rule: 'leaders',
      text: `${a.code} and ${b.code} roles ${verb} ${values} ${windowLabel(a.change)}.`,
      numbers: { first: a.code, firstChange: a.change.value, second: b.code, secondChange: b.change.value },
    };
  },
  function seniority({ levels }) {
    const total = [...levels.values()].reduce((n, v) => n + v, 0);
    const senior = levels.get('senior') ?? 0;
    if (total <= 0 || senior <= 0) return null;
    const share = senior / total;
    return {
      rule: 'seniority',
      text: `Senior roles are ${(share * 100).toFixed(0)}% of open tech roles.`,
      numbers: { share, senior, total },
    };
  },
  function flow({ flow }) {
    if (!flow || flow.opened + flow.closed === 0) return null;
    return {
      rule: 'flow',
      text: `${fmtInt(flow.opened)} roles opened and ${fmtInt(flow.closed)} closed since ${formatDayShort(flow.since)}.`,
      numbers: { opened: flow.opened, closed: flow.closed, since: flow.since },
    };
  },
  function geography({ countries }) {
    const total = [...countries.values()].reduce((n, v) => n + v, 0);
    const ranked = [...countries.entries()].filter(([c]) => c !== '').sort((x, y) => y[1] - x[1]);
    const [first, second] = ranked;
    if (!first || !second || total <= 0) return null;
    return {
      rule: 'geography',
      text: `${countryName(first[0])} holds ${((first[1] / total) * 100).toFixed(1)}% of open roles; ${countryName(second[0])} is next at ${((second[1] / total) * 100).toFixed(1)}%.`,
      numbers: { first: first[0], firstShare: first[1] / total, second: second[0], secondShare: second[1] / total },
    };
  },
];

/** All notes the rules can write today, in display priority. */
export function writeNotes(input: NoteInput): Note[] {
  return RULES.map((rule) => rule(input)).filter((n): n is Note => n !== null);
}

function signed(f: number): string {
  return `${f >= 0 ? '+' : '−'}${fmtPct(f)}`;
}
