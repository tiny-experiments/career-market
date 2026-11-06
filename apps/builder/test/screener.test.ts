import { describe, expect, it } from 'vitest';
import { companySlugs, signalFor, skillSlugs, topSkillIds, workModeCounts } from '../src/screener/compute.ts';

describe('screener compute', () => {
  it('counts only roles that state a work mode', () => {
    expect(workModeCounts([{ value: 'remote', count: 5 }, { value: 'onsite', count: 2 }])).toEqual({ remote: 5, hybrid: 0, onsite: 2 });
    expect(workModeCounts([])).toEqual({ remote: 0, hybrid: 0, onsite: 0 });
  });

  it('takes the three largest tool-like skills', () => {
    const list = [
      { value: 'concept:testing', count: 90 },
      { value: 'lang:python', count: 80 },
      { value: 'practice:agile', count: 70 },
      { value: 'cloud:aws', count: 60 },
      { value: 'lang:java', count: 50 },
      { value: 'lang:go', count: 40 },
    ];
    expect(topSkillIds(list)).toEqual(['lang:python', 'cloud:aws', 'lang:java']);
  });

  it('gives a signal only with enough comparable days, never counting bootstrap days', () => {
    // n comparable days after the 3 Nov base day; the last day holds `last`.
    const days = (n: number, last: number) => [
      { date: '2026-11-02', open: 5 }, // bootstrap day: ignored
      ...Array.from({ length: n + 1 }, (_, i) => ({ date: `2026-11-${String(i + 3).padStart(2, '0')}`, open: i === n ? last : 100 })),
    ];
    expect(signalFor(days(0, 100))).toEqual({ signal: null, days: 0 });
    expect(signalFor(days(6, 150))).toEqual({ signal: null, days: 6 });
    expect(signalFor(days(7, 106))).toEqual({ signal: 'ramping', days: 7 });
    expect(signalFor(days(10, 85)).signal).toBe('freezing');
    expect(signalFor(days(10, 100)).signal).toBe('steady');
    expect(signalFor([]).signal).toBeNull();
  });

  it('keeps page slugs unique', () => {
    const slugs = companySlugs([
      { id: 'co_aaaaaaaaaaaaaaaa', name: 'Acme' },
      { id: 'co_bbbbbbbbbbbbbbbb', name: 'ACME!' },
    ]);
    expect(slugs.get('co_aaaaaaaaaaaaaaaa')).toBe('acme');
    expect(slugs.get('co_bbbbbbbbbbbbbbbb')).toBe('acme-bbbb');
    const skills = skillSlugs(['data:etl', 'domain:etl']);
    expect(skills.get('data:etl')).toBe('etl');
    expect(skills.get('domain:etl')).toBe('domain-etl');
  });
});
