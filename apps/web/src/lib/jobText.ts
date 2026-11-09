/**
 * Turns an employer's job text into readable blocks: headings, paragraphs and
 * bullet lists. The text arrives plain; many employers send it as
 * one run with labels such as "Responsibilities:" in the middle, so known section
 * labels start a new heading. Nothing is added to the text: only line breaks and
 * bullet markers move. Headings exist only when the employer's text has them.
 *
 * Most postings arrive with every line break gone, so a list reads as one run:
 * "Agents that vet experts Pay models that retain them Workflows that scale".
 * After a colon, such a run is put back into bullets, but only when it clearly
 * is one; ordinary sentences are left alone. The result is always plain text
 * for React to render, never markup.
 */
export type TextBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

/** Section labels employers use. Matched only when followed by a colon, or alone on a line. */
const LABELS = [
  "about the role",
  "about the team",
  "about the job",
  "about this role",
  "about us",
  "about you",
  "overview",
  "job summary",
  "summary",
  "role summary",
  "the role",
  "what you'll do",
  "what you’ll do",
  "what you will do",
  "what you'll be doing",
  "what you’ll be doing",
  "responsibilities",
  "key responsibilities",
  "key job responsibilities",
  "job responsibilities",
  "your responsibilities",
  "in this role",
  "minimum qualifications",
  "basic qualifications",
  "required qualifications",
  "preferred qualifications",
  "qualifications",
  "requirements",
  "minimum requirements",
  "basic requirements",
  "preferred requirements",
  "what we're looking for",
  "what we’re looking for",
  "what you bring",
  "what you'll bring",
  "what you’ll bring",
  "who we're looking for",
  "who we’re looking for",
  "who you are",
  "nice to have",
  "nice-to-haves",
  "preferred skills",
  "required skills",
  "skills and experience",
  "what we offer",
  "benefits",
  "compensation",
  "pay and benefits",
  "pay & benefits",
  "equal opportunity",
] as const;

const LABEL_SOURCE = LABELS.map((l) =>
  l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
).join("|");
/** A label inside running text: preceded by the start, a sentence end or a space, followed by a colon. */
const INLINE_LABEL = new RegExp(
  `(^|[.!?)\\]]\\s+|\\s{2,}|\\n)(${LABEL_SOURCE})\\s*:`,
  "gi",
);
/** The same labels written with a capital first letter, as employers write them, after a plain space. */
const titleCased = (label: string) =>
  label
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
const CAPITAL_LABEL_SOURCE = LABELS.flatMap((label) => [
  titleCased(label),
  label.charAt(0).toUpperCase() + label.slice(1),
])
  .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const INLINE_CAPITAL_LABEL = new RegExp(
  `(?:(\\S) |^)(${CAPITAL_LABEL_SOURCE})\\s*:`,
  "gm",
);
const LABEL_LINE = new RegExp(`^(${LABEL_SOURCE})\\s*:?$`, "i");
/** A label that lost its line and its colon: "goals Who We're Looking For We want". */
const BARE_LABEL = new RegExp(
  `(^|\\S+\\s+)(${LABEL_SOURCE})\\s+(?=[A-Z$-])`,
  "gi",
);
/** After a colon, up to the end of the sentence; "$1.5K" and "0.5" do not end one. */
const AFTER_COLON = /:\s+((?:[^.!?:\n]|[.!?](?=\S))+)([.!?]?)\s*/g;

/** Words a name can follow mid-sentence: a capital after one is no new bullet. */
const JOINING_WORDS = new Set(
  (
    "a an the of in on at for to with and or but by from into onto as our your their its " +
    "his her this that these those is are was were be been being will would can could may " +
    "must should have has had using use used including include includes like such via per " +
    "over under across within about than both either each all any some new strong modern " +
    "leading global senior junior lead key core major top best large small first " +
    "experience knowledge building developing"
  ).split(" "),
);
const BULLET_MIN_LENGTH = 12;
const BULLET_MAX_LENGTH = 240;
const BULLET_MIN_WORDS = 3;
const BULLETS_MIN = 3;

const count = (word: string, mark: string) => word.split(mark).length - 1;

const endsItem = (word: string) =>
  /^[a-z0-9$]/.test(word) &&
  /[a-z0-9)%+]$/.test(word) &&
  !JOINING_WORDS.has(word);

const startsItem = (word: string) => /^[A-Z][a-z]/.test(word);

/** The bullets inside a run with its line breaks gone, or null when it is just prose. */
export function lostBullets(run: string): string[] | null {
  const words = run.trim().split(/\s+/);
  const items: string[][] = [[]];
  let depth = 0;
  words.forEach((word, index) => {
    const previous = words[index - 1];
    // Inside brackets a capital starts a name, never a new bullet.
    if (depth === 0 && previous && endsItem(previous) && startsItem(word)) {
      items.push([]);
    }
    items.at(-1)?.push(word);
    depth = Math.max(
      0,
      depth +
        count(word, "(") +
        count(word, "[") -
        count(word, ")") -
        count(word, "]"),
    );
  });
  const clear =
    items.length >= BULLETS_MIN &&
    items.every((item) => {
      const length = item.join(" ").length;
      return (
        item.length >= BULLET_MIN_WORDS &&
        length >= BULLET_MIN_LENGTH &&
        length <= BULLET_MAX_LENGTH
      );
    });
  return clear ? items.map((item) => item.join(" ")) : null;
}

/** A dash or dot standing where a bullet's line began: " - Build". */
const INLINE_BULLET = /\s[-–•*▪]\s+(?=[A-Z0-9])/g;
const INLINE_BULLETS_MIN = 3;

/** Puts dashed lists back on their own lines; one stray " - " is only a dash. */
export function breakInlineBullets(text: string): string {
  const found = text.match(INLINE_BULLET)?.length ?? 0;
  return found >= INLINE_BULLETS_MIN
    ? text.replace(INLINE_BULLET, "\n- ")
    : text;
}

/** A marker in running text: " 2. Build" or " 2) Build". */
const NUMBER_MARK = /(^|\s)(\d{1,2})[.)]\s+(?=[A-Z])/g;

/**
 * Puts counted lists back on their own lines: "1. Build it. 2. Ship it." Only
 * a run that counts up from 1 is a list; "over 2. Then" is not.
 */
export function breakNumberedLists(text: string): string {
  const marks = [...text.matchAll(NUMBER_MARK)];
  const breaks = new Set<number>();
  let run: number[] = [];
  const close = () => {
    if (run.length >= 2) run.forEach((index) => breaks.add(index));
    run = [];
  };
  for (const mark of marks) {
    const number = Number(mark[2]);
    if (number === 1) close();
    if (number === run.length + 1) run.push(mark.index);
    else close();
  }
  close();
  if (breaks.size === 0) return text;
  return text.replace(NUMBER_MARK, (match, _lead, _number, offset: number) =>
    breaks.has(offset) ? `\n${match.trimStart()}` : match,
  );
}

function isTitleCase(label: string): boolean {
  return label
    .split(/\s+/)
    .every((word) => word.length <= 3 || /^[A-Z]/.test(word));
}

function breakBareLabel(
  match: string,
  lead: string,
  label: string,
  offset: number,
  text: string,
): string {
  const before = lead.trim();
  const opensLine =
    before === "" ||
    /[.!?:)]$/.test(before) ||
    (/[a-z0-9]$/.test(before) && !JOINING_WORDS.has(before.toLowerCase()));
  // A bullet straight after is proof enough; otherwise it must look like a title.
  const next = text.charAt(offset + match.length);
  const headsList = next === "-";
  // The pattern ignores case, so what follows is checked here.
  const nextOpens = /[A-Z$-]/.test(next);
  return opensLine && nextOpens && (headsList || isTitleCase(label))
    ? `${lead.trimEnd()}\n\n${label}:\n`
    : match;
}

function restoreBullets(match: string, run: string, end: string): string {
  const items = lostBullets(run);
  if (items === null) return match;
  const lines = items.map((item) => `- ${item}`).join("\n");
  return `:\n${lines}${end}\n\n`;
}
const BULLET = /^\s*(?:[-*•·▪‣◦–]|\d{1,2}[.)])\s+(.*\S)\s*$/;
/** A long paragraph is cut at sentence ends into pieces this long. */
const PARAGRAPH_TARGET = 520;

export function parseJobText(raw: string): TextBlock[] {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (!text) return [];
  const withBreaks = breakInlineBullets(breakNumberedLists(text))
    .replace(
      INLINE_LABEL,
      (_m, lead: string, label: string) => `${lead.trimEnd()}\n\n${label}:\n`,
    )
    .replace(
      INLINE_CAPITAL_LABEL,
      (_m, prev: string | undefined, label: string) =>
        `${prev ?? ""}\n\n${label}:\n`,
    )
    .replace(BARE_LABEL, breakBareLabel)
    .replace(AFTER_COLON, restoreBullets);

  const blocks: TextBlock[] = [];
  let list: string[] | null = null;
  const flushList = () => {
    if (list && list.length > 0) blocks.push({ type: "list", items: list });
    list = null;
  };

  for (const chunk of withBreaks.split(/\n{2,}/)) {
    const lines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    let paragraph: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length > 0) {
        for (const piece of splitLong(paragraph.join(" ")))
          blocks.push({ type: "paragraph", text: piece });
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
        blocks.push({ type: "heading", text: line.replace(/\s*:$/, "") });
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
  let current = "";
  for (const s of sentences) {
    if (current && current.length + s.length > target) {
      out.push(current.trim());
      current = "";
    }
    current += s;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
