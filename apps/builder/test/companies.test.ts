import { describe, expect, it } from 'vitest';
import { careersUrl } from '../src/companies/write.ts';
import { planCompanyDays } from '../src/companies/pull.ts';
import { companySeries } from '@cm/core/company';
import { changePoints, companySignal, explainer, signalState } from '../src/companies/compute.ts';
import { computeChange } from '../src/compute/changes.ts';

const row = (date: string, open: number, n = 0, closed = 0) => ({ date, open, new: n, closed });

describe('companySeries', () => {
  it('leaves out bootstrap days and the day a board is first fetched', () => {
    const s = companySeries([row('2026-11-02', 100, 100), row('2026-11-03', 100), row('2026-11-04', 110, 12, 2), row('2026-11-05', 0), row('2026-11-06', 40, 40)], '2026-11-06');
    expect(s.days.map((d) => [d.date.slice(8), d.excluded])).toEqual([
      ['02', true],
      ['03', true],
      ['04', false],
      ['05', false],
      ['06', true],
    ]);
    // The board that vanished and returned on the 6th starts a new segment.
    expect(s.segmentStart).toBe('2026-11-06');
  });

  it('treats a missing day as zero and a company with no open roles today as having no segment', () => {
    const s = companySeries([row('2026-11-02', 5, 5)], '2026-11-04');
    expect(s.days).toHaveLength(3);
    expect(s.segmentStart).toBeNull();
    expect(changePoints(s)).toEqual([]);
  });
});

describe('board events', () => {
  it('treats a bulk first fetch of a second board as a segment restart', () => {
    const s = companySeries([row('2026-11-03', 435, 435), row('2026-11-04', 436, 1), row('2026-11-05', 438, 2), row('2026-11-06', 1736, 1302, 4)], '2026-11-06');
    expect(s.segmentStart).toBe('2026-11-06');
    expect(companySignal(s, '2026-11-06')).toBeNull();
  });
  it('keeps ordinary hiring days', () => {
    const s = companySeries([row('2026-11-03', 1681, 51), row('2026-11-04', 1684, 3), row('2026-11-05', 1693, 21, 12)], '2026-11-05');
    expect(s.segmentStart).toBe('2026-11-03');
    expect(s.days.filter((d) => !d.excluded)).toHaveLength(2);
  });
});

describe('companySignal', () => {
  const rows = [row('2026-11-02', 100, 100), row('2026-11-03', 100), row('2026-11-04', 104, 6, 2), row('2026-11-05', 109, 8, 3), row('2026-11-06', 112, 7, 4)];
  const series = companySeries(rows, '2026-11-06');

  it('sums openings and closings over the comparable days and flags a short window', () => {
    const s = companySignal(series, '2026-11-06');
    expect(s).toMatchObject({ windowFrom: '2026-11-04', windowDays: 3, opened: 21, closed: 9, openBase: 100, partial: true });
    expect(s?.change).toBeCloseTo(0.12);
    expect(s?.state).toBe('RAMPING');
  });

  it('has no signal before a comparable day exists', () => {
    expect(companySignal(companySeries(rows.slice(0, 2), '2026-11-03'), '2026-11-03')).toBeNull();
  });

  it('classifies the mockup examples', () => {
    expect(signalState({ opened: 20, closed: 62, change: -0.18 })).toBe('FREEZING');
    expect(signalState({ opened: 20, closed: 44, change: -0.11 })).toBe('COOLING');
    expect(signalState({ opened: 30, closed: 10, change: 0.07 })).toBe('RAMPING');
    expect(signalState({ opened: 2, closed: 1, change: 0.5 })).toBe('STEADY');
  });
});

describe('change of a company that was fetched late', () => {
  it('compares from its own first day, not from zero', () => {
    const series = companySeries([row('2026-11-05', 200, 200), row('2026-11-06', 210, 15, 5)], '2026-11-06');
    const c = computeChange(changePoints(series), '2026-11-06', '1W');
    expect(c).toMatchObject({ partial: true, baseDate: '2026-11-05' });
    expect(c?.value).toBeCloseTo(0.05);
  });
});

describe('explainer', () => {
  const sig = { state: 'RAMPING', windowFrom: '2026-11-04', windowDays: 3, opened: 24, closed: 10, openBase: 100, partial: true, change: 0.14 } as const;
  it('writes the ratio and the level that moved most', () => {
    expect(explainer(sig, [{ level: 'senior', delta: 9 }, { level: 'mid', delta: 1 }])).toBe(
      'Openings outpace closings 2.4 : 1 over 3 days since 4 Nov; senior roles up most.',
    );
  });
  it('says so when nothing is comparable yet', () => {
    expect(explainer(null, [])).toMatch(/bootstrap|counted every role/);
  });
  it('writes closings first when they dominate', () => {
    expect(explainer({ ...sig, opened: 5, closed: 20 }, [{ level: 'mid', delta: -6 }])).toBe(
      'Closings outpace openings 4.0 : 1 over 3 days since 4 Nov; mid roles down most.',
    );
  });
});

describe('planCompanyDays', () => {
  const observed = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  it('fetches recent days and any day not stored yet', () => {
    expect(planCompanyDays(observed, new Set(['2026-11-02']), '2026-11-06', 2, false)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(planCompanyDays(observed, new Set(observed), '2026-11-06', 2, false)).toEqual(['2026-11-05', '2026-11-06']);
    expect(planCompanyDays(observed, new Set(observed), '2026-11-06', 2, true)).toEqual(observed);
  });
});

describe('careersUrl', () => {
  it('picks the live board with the most roles', () => {
    expect(
      careersUrl([
        { url: 'https://a.example/careers', status: 'live', openJobs: 0 },
        { url: 'https://b.example/jobs', status: 'live', openJobs: 90 },
        { url: 'https://c.example', status: 'gone', openJobs: 500 },
      ]),
    ).toBe('https://b.example/jobs');
    expect(careersUrl([])).toBeNull();
  });
});
