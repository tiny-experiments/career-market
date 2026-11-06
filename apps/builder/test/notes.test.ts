import { describe, expect, it } from 'vitest';
import { writeNotes } from '../src/compute/notes.ts';
import { systematicSample } from '../src/pull.ts';

const change = (value: number, partial = false) => ({ range: '1W' as const, value, baseDate: '2026-11-03', partial, estimated: false });

describe('writeNotes', () => {
  it('writes momentum, leaders and seniority notes from the numbers', () => {
    const notes = writeNotes({
      asOf: '2026-11-05',
      open: 242_947,
      marketChange: change(0.021),
      families: [
        { code: 'AIML', name: 'AI & ML', open: 10_445, change: change(0.068) },
        { code: 'INFRA', name: 'Platform & Infra', open: 13_353, change: change(0.006) },
      ],
      levels: new Map([
        ['senior', 35],
        ['mid', 50],
        ['', 15],
      ]),
      countries: new Map([
        ['US', 40],
        ['IN', 12],
        ['', 5],
      ]),
      flow: { opened: 6822, closed: 6823, since: '2026-11-04' },
    });
    expect(notes.map((n) => n.rule)).toEqual(['momentum', 'leaders', 'seniority', 'flow', 'geography']);
    expect(notes[0]?.text).toBe('Hiring momentum up 2.1% this week, with 242,947 open roles.');
    expect(notes[1]?.text).toBe('AIML and INFRA roles lead, up 6.8% and 0.6% this week.');
    expect(notes[2]?.text).toBe('Senior roles are 35% of open tech roles.');
    expect(notes[4]?.text).toBe('US holds 70.2% of open roles; India is next at 21.1%.');
  });

  it('says when a change covers fewer days than the range', () => {
    const [note] = writeNotes({
      asOf: '2026-11-05',
      open: 1000,
      marketChange: change(-0.01, true),
      families: [],
      levels: new Map(),
      countries: new Map(),
      flow: null,
    });
    expect(note?.text).toBe('Hiring momentum down 1.0% since 3 Nov, with 1,000 open roles.');
  });
});

describe('systematicSample', () => {
  it('spreads picks over the whole list', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    expect(systematicSample(items, 4)).toEqual([12, 37, 62, 87]);
    expect(systematicSample([1, 2], 5)).toEqual([1, 2]);
  });
});
