import type { CompanySeries, DayRow, SeriesDay } from '@cm/core/company';
import { EXPLAINER_NO_SIGNAL, type CompanySignalState } from '@cm/core/company';
import { addDays, formatDayShort, type IsoDay } from '@cm/core/dates';
import { titleCase } from '@cm/core/codes';
import type { ValuePoint } from '../compute/changes.ts';

/** Days a hiring signal looks back over (fewer while history is short). */
export const SIGNAL_WINDOW_DAYS = 30;

/** Values the change ranges are computed from: the current segment only. */
export function changePoints(series: CompanySeries): ValuePoint[] {
  if (!series.segmentStart) return [];
  const start = series.segmentStart;
  return series.days.filter((d) => d.date >= start).map((d) => ({ date: d.date, value: d.open, estimated: false }));
}

export interface SignalCalc {
  state: CompanySignalState;
  windowFrom: IsoDay;
  windowDays: number;
  opened: number;
  closed: number;
  /** Open roles the day before the window. */
  openBase: number;
  partial: boolean;
  /** Change of open roles over the window; null when the base is empty. */
  change: number | null;
}

/** Thresholds for the badge. They match the mockup: -18% with 3.1x closings is FREEZING, -11% with 2.2x is COOLING. */
export const SIGNAL_RULES = {
  rampChange: 0.05,
  rampRatio: 1.5,
  coolChange: -0.03,
  coolRatio: 1.5,
  freezeChange: -0.1,
  freezeRatio: 2.5,
  /** Below this many openings plus closings the window says nothing. */
  minFlow: 5,
} as const;

/** The signal over the last 30 comparable days; null when none is comparable yet. */
export function companySignal(series: CompanySeries, asOf: IsoDay): SignalCalc | null {
  const first = addDays(asOf, -(SIGNAL_WINDOW_DAYS - 1));
  const start = series.segmentStart;
  if (!start) return null;
  // Only the current fetch segment: an earlier one ended in a board event.
  const flow = series.days.filter((d) => !d.excluded && d.date >= first && d.date >= start && d.date <= asOf);
  const today = series.days.at(-1);
  if (flow.length === 0 || !today) return null;
  const windowFrom = (flow[0] as SeriesDay).date;
  const opened = sum(flow.map((d) => d.new));
  const closed = sum(flow.map((d) => d.closed));
  const before = series.days.find((d) => d.date === addDays(windowFrom, -1));
  const openBase = before ? before.open : Math.max(0, (flow[0] as SeriesDay).open - (flow[0] as SeriesDay).new + (flow[0] as SeriesDay).closed);
  const change = openBase > 0 ? today.open / openBase - 1 : null;
  return {
    state: signalState({ opened, closed, change }),
    windowFrom,
    windowDays: flow.length,
    opened,
    closed,
    openBase,
    partial: flow.length < SIGNAL_WINDOW_DAYS,
    change,
  };
}

export function signalState(input: { opened: number; closed: number; change: number | null }): CompanySignalState {
  const { opened, closed, change } = input;
  const r = SIGNAL_RULES;
  if (change === null || opened + closed < r.minFlow) return 'STEADY';
  if (change >= r.rampChange && opened >= r.rampRatio * closed) return 'RAMPING';
  if (change <= r.freezeChange && closed >= r.freezeRatio * opened) return 'FREEZING';
  if (change <= r.coolChange && closed >= r.coolRatio * opened) return 'COOLING';
  return 'STEADY';
}

export interface LevelDelta {
  level: string;
  /** Open roles at that level today minus the day before the window. */
  delta: number;
}

/** The one sentence under the chart. */
export function explainer(signal: SignalCalc | null, levels: readonly LevelDelta[]): string {
  if (!signal) {
    return EXPLAINER_NO_SIGNAL;
  }
  const n = signal.windowDays;
  const span = signal.partial ? `${n} day${n === 1 ? '' : 's'} since ${formatDayShort(signal.windowFrom)}` : `${n} days`;
  const { opened, closed } = signal;
  let head: string;
  if (opened === 0 && closed === 0) head = `No openings or closings over ${span}`;
  else if (closed === 0) head = `${opened} opening${opened === 1 ? '' : 's'} and no closings over ${span}`;
  else if (opened === 0) head = `${closed} closing${closed === 1 ? '' : 's'} and no openings over ${span}`;
  else {
    const ratio = opened / closed;
    if (ratio >= 0.9 && ratio <= 1.1) head = `Openings and closings are in balance over ${span}`;
    else if (ratio > 1.1) head = `Openings outpace closings ${ratio.toFixed(1)} : 1 over ${span}`;
    else head = `Closings outpace openings ${(1 / ratio).toFixed(1)} : 1 over ${span}`;
  }
  const named = levels.filter((l) => l.level !== '');
  const up = [...named].sort((a, b) => b.delta - a.delta)[0];
  const down = [...named].sort((a, b) => a.delta - b.delta)[0];
  let tail = '';
  if (up && up.delta > 0) tail = `; ${titleCase(up.level).toLowerCase()} roles up most`;
  else if (down && down.delta < 0) tail = `; ${titleCase(down.level).toLowerCase()} roles down most`;
  return `${head}${tail}.`;
}

export function sum(values: readonly number[]): number {
  return values.reduce((n, v) => n + v, 0);
}
