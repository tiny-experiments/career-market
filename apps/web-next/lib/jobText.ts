/**
 * Turns an employer's job text into readable blocks: headings, paragraphs and
 * bullet lists. krill serves the text as plain text; many employers send it as
 * one run with labels such as "Responsibilities:" in the middle, so known section
 * labels start a new heading. Nothing is added to the text: only line breaks and
 * bullet markers move. Headings exist only when the employer's text has them.
 */
export type TextBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

/** Section labels employers use. Matched only when followed by a colon, or alone on a line. */
const LABELS = [
  'about the role',
  'about the team',
  'about the job',
  'about this role',
  'about us',
  'about you',
  'overview',
  'job summary',
  'summary',
  'role summary',
  'the role',
  'what you\'ll do',
  'what you’ll do',
  'what you will do',
  'what you\'ll be doing',
  'what you’ll be doing',
  'responsibilities',
  'key responsibilities',
  'job responsibilities',
  'your responsibilities',
  'in this role',
  'minimum qualifications',
  'basic qualifications',
  'required qualifications',
  'preferred qualifications',
  'qualifications',
  'requirements',
  'minimum requirements',
  'basic requirements',
  'preferred requirements',
  'what we\'re looking for',
  'what we’re looking for',
  'what you bring',
  'who you are',
  'nice to have',
  'nice-to-haves',
  'preferred skills',
  'required skills',
  'skills and experience',
  'what we offer',
  'benefits',
  'compensation',
  'pay and benefits',
  'pay & benefits',
  'equal opportunity',
] as const;

const LABEL_SOURCE = LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
/** A label inside running text: preceded by the start, a sentence end or a space, followed by a colon. */
const INLINE_LABEL = new RegExp(`(^|[.!?)\\]]\\s+|\\s{2,}|\\n)(${LABEL_SOURCE})\\s*:`, 'gi');
/** The same labels written with a capital first letter, as employers write them, after a plain space. */
const CAPITAL_LABEL_SOURCE = LABELS.map((l) => l.charAt(0).toUpperCase() + l.slice(1))
  .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const INLINE_CAPITAL_LABEL = new RegExp(`(\\S) (${CAPITAL_LABEL_SOURCE})\\s*:`, 'g');
const LABEL_LINE = new RegExp(`^(${LABEL_SOURCE})\\s*:?$`, 'i');
const BULLET = /^\s*(?:[-*•·▪‣◦–]|\d{1,2}[.)])\s+(.*\S)\s*$/;
/** A long paragraph is cut at sentence ends into pieces this long. */
const PARAGRAPH_TARGET = 520;

export function parseJobText(raw: string): TextBlock[] {
  const text = raw.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) return [];
  const withBreaks = text
    .replace(INLINE_LABEL, (_m, lead: string, label: string) => `${lead.trimEnd()}\n\n${label}:\n`)
    .replace(INLINE_CAPITAL_LABEL, (_m, prev: string, label: string) => `${prev}\n\n${label}:\n`);

  const blocks: TextBlock[] = [];
  let list: string[] | null = null;
  const flushList = () => {
    if (list && list.length > 0) blocks.push({ type: 'list', items: list });
    list = null;
  };

  for (const chunk of withBreaks.split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    let paragraph: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length > 0) {
        for (const piece of splitLong(paragraph.join(' '))) blocks.push({ type: 'paragraph', text: piece });
      }
      paragraph = [];
    };
    for (const line of lines) {
      const bullet = BULLET.exec(line);
      if (bullet) {
        flushParagraph();
        (list ??= []).push(bullet[1] as string);
      } else if (LABEL_LINE.test(line)) {
        flushParagraph();
        flushList();
        blocks.push({ type: 'heading', text: line.replace(/\s*:$/, '') });
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}

/** Cuts a long run of text at sentence ends, so a wall of text reads as paragraphs. */
export function splitLong(text: string, target = PARAGRAPH_TARGET): string[] {
  if (text.length <= target * 1.5) return [text];
  const sentences = text.match(/[^.!?]+(?:[.!?]+["')\]]?|$)\s*/g) ?? [text];
  const out: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current && current.length + s.length > target) {
      out.push(current.trim());
      current = '';
    }
    current += s;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
