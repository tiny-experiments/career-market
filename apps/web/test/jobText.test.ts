import { describe, expect, it } from 'vitest';
import { parseJobText, splitLong } from '../lib/jobText.ts';

describe('parseJobText', () => {
  it('turns section labels in one long run into headings, and keeps every word', () => {
    const text =
      'Join the team. You will build things. Responsibilities: Develop models. Advance research. Minimum qualifications: Experience with PyTorch Proficient in Python Preferred qualifications: M.S. in CS';
    const blocks = parseJobText(text);
    expect(blocks.filter((b) => b.type === 'heading').map((b) => (b as { text: string }).text)).toEqual([
      'Responsibilities',
      'Minimum qualifications',
      'Preferred qualifications',
    ]);
    const words = (s: string) => s.replace(/\s+/g, ' ').replace(/:/g, '').trim();
    const rebuilt = blocks.map((b) => (b.type === 'list' ? b.items.join(' ') : b.text)).join(' ');
    expect(words(rebuilt)).toBe(words(text));
  });

  it('reads bullet lines as lists and plain lines as paragraphs', () => {
    const blocks = parseJobText('About the role\nWe build speech models.\n\nWhat you\'ll do:\n- Train models\n• Ship them\n* Monitor them\n1. Repeat');
    expect(blocks).toEqual([
      { type: 'heading', text: 'About the role' },
      { type: 'paragraph', text: 'We build speech models.' },
      { type: 'heading', text: "What you'll do" },
      { type: 'list', items: ['Train models', 'Ship them', 'Monitor them', 'Repeat'] },
    ]);
  });

  it('does not treat a label word inside a sentence as a heading', () => {
    const blocks = parseJobText('Our benefits: are good. Please review the requirements for this role carefully.');
    expect(blocks.some((b) => b.type === 'heading' && b.text.toLowerCase() === 'requirements')).toBe(false);
  });

  it('returns nothing for empty text and never produces markup', () => {
    expect(parseJobText('  \n ')).toEqual([]);
    expect(parseJobText('<script>alert(1)</script>')).toEqual([{ type: 'paragraph', text: '<script>alert(1)</script>' }]);
  });
});

describe('splitLong', () => {
  it('keeps short text whole and cuts long text at sentence ends', () => {
    expect(splitLong('One. Two.')).toEqual(['One. Two.']);
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const parts = splitLong(long, 200);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.every((p) => p.endsWith('.'))).toBe(true);
    expect(parts.join(' ')).toBe(long);
  });
});
