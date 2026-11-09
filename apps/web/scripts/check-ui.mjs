#!/usr/bin/env node
/**
 * The UI rules that a reviewer should never have to repeat (docs/UI-RULEBOOK.md):
 * tokens only, no magic numbers, primitives from components/ui, PascalCase
 * component files, files that stay readable. Fails CI on a violation unless
 * scripts/check-ui.allowlist.json names it with a reason.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const ALLOW_LIST = join(WEB, "scripts", "check-ui.allowlist.json");

const SOURCE = /\.(ts|tsx|css|js|jsx)$/;
const TOKEN_FILE = "src/index.css";
const PRIMITIVES = "src/components/ui/";
const WARN_LINES = 500;
const FAIL_LINES = 1000;

const HEX =
  /(?<![&\w#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
// Only a call with numbers in it is a colour; prose such as "oklch()" is not.
const COLOUR_FUNCTION =
  /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-+.\d][^)]*\)/g;
const HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_UTILITIES =
  "bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|drop-shadow|text-shadow";
const PALETTE = new RegExp(
  `(?<![\\w-])-?(?:${COLOUR_UTILITIES})-(?:(?:${HUES})-(?:50|[1-9]00|950)|black|white)(?![\\w-])`,
  "g",
);
const RAW_ELEMENT = /<(button|input|select|textarea|dialog)(?=[\s/>]|$)/gm;
const COMPONENT_NAME = /^(?:[A-Z][A-Za-z0-9]*|use[A-Z][A-Za-z0-9]*)\.tsx$/;
// Customer-facing copy never names where the data comes from.
const PROVIDER = /\bkrill\b/gi;
// Nor how a figure is made (UI-RULEBOOK.md §9): these words describe the
// method, and the method belongs in a hover card said plainly, not on the page.
const RETIRED = /\b(?:survival|back-?cast|estimated|bootstrap)\b/gi;
// Pages outside src/ that a visitor reads.
const EXTRA_FILES = ["index.html"];

const ANSI = {
  bold: (s) => `\u001b[1m${s}\u001b[22m`,
  dim: (s) => `\u001b[2m${s}\u001b[22m`,
  red: (s) => `\u001b[31m${s}\u001b[39m`,
  green: (s) => `\u001b[32m${s}\u001b[39m`,
  yellow: (s) => `\u001b[33m${s}\u001b[39m`,
};
const colour =
  process.stdout.isTTY && !process.env.NO_COLOR
    ? ANSI
    : {
        bold: (s) => s,
        dim: (s) => s,
        red: (s) => s,
        green: (s) => s,
        yellow: (s) => s,
      };

export const RULES = {
  "raw-colour":
    "Use a colour token from src/index.css (bg-card, text-up, text-muted-foreground…).",
  "palette-colour":
    "Use a colour token instead of a Tailwind palette name (text-up, bg-tile…).",
  "arbitrary-value":
    "Use a step from the scales in docs/UI-RULEBOOK.md, or name a new token in src/index.css.",
  "file-name":
    "Name component files in PascalCase after their component (MarketCard.tsx).",
  "file-length": `Split the file; it warns above ${WARN_LINES} lines and fails above ${FAIL_LINES}.`,
  "raw-element":
    "Use the primitive from src/components/ui/ (Button, Input, Select…).",
  "provider-name":
    "Never name the data source in the app; say what the figure is instead.",
  "retired-word":
    "Say what the figure is, not how it is made; the word is retired from customer-facing text (docs/UI-RULEBOOK.md §9).",
};

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

function matches(pattern, text, rule, path) {
  return [...text.matchAll(pattern)].map((match) => ({
    path,
    line: lineAt(text, match.index),
    rule,
    value: match[0],
  }));
}

/** Index just past the `]` that closes the `[` at `open`, or -1. */
function closeBracket(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]" && --depth === 0) return i + 1;
    else if (text[i] === "\n") return -1;
  }
  return -1;
}

/**
 * Arbitrary values such as `p-[13px]` or `focus:ring-[3px]`, reported without
 * their variants. Arbitrary variants such as `data-[side=top]:` end in a colon
 * (after an optional `/name`) and are selectors, not values.
 */
export function arbitraryValues(text, path) {
  const found = [];
  let from = 0;
  for (;;) {
    const open = text.indexOf("-[", from);
    if (open === -1) return found;
    let start = open;
    while (start > 0 && /[A-Za-z0-9-]/.test(text[start - 1])) start--;
    const end = closeBracket(text, open + 1);
    if (end === -1) {
      from = open + 2;
      continue;
    }
    from = end;
    const utility = text.slice(start, open);
    if (!/^-?[a-z][a-z0-9-]*$/.test(utility)) continue;
    if (/^(?:\/[\w-]+)?:/.test(text.slice(end))) continue;
    found.push({
      path,
      line: lineAt(text, start),
      rule: "arbitrary-value",
      value: text.slice(start, end),
    });
  }
}

// Text between tags that is not an expression: `>Open roles<`, but not `>{x}<`.
// The `>` must close a tag, so the one in `=>` or `a > b` never opens text.
const JSX_TEXT = /(?<=[\w"'}/]|\n[ \t]*)>([^<>{}]+)</g;

const blank = (text) => text.replace(/[^\n]/g, " ");

/** Index just past the string that opens at `start`, or -1 when it never closes. */
function stringEnd(text, start) {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === quote) return i + 1;
    else if (text[i] === "\n" && quote !== "`") return -1;
  }
  return -1;
}

/**
 * Splits a source file into its string literals and a copy of the code with
 * comments and string contents blanked out, so offsets still line up.
 */
function scan(text) {
  const strings = [];
  let code = "";
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "/" && (next === "/" || next === "*")) {
      const close =
        next === "/" ? text.indexOf("\n", i) : text.indexOf("*/", i + 2);
      const end = close === -1 ? text.length : next === "/" ? close : close + 2;
      code += blank(text.slice(i, end));
      i = end;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const end = stringEnd(text, i);
      if (end !== -1) {
        strings.push({ text: text.slice(i, end), index: i });
        code += char + blank(text.slice(i + 1, end - 1)) + char;
        i = end;
        continue;
      }
    }
    code += char;
    i++;
  }
  return { strings, code };
}

/**
 * The parts of a source file a visitor can read: string literals and the
 * text between JSX tags, each with the offset it starts at. Comments and
 * identifiers (`point.estimated`) are code and are left alone; an HTML file
 * is read whole.
 */
export function customerFacingText(text, path) {
  if (path.endsWith(".html")) return [{ text, index: 0 }];
  const { strings, code } = scan(text);
  const parts = [...strings];
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) {
    for (const match of code.matchAll(JSX_TEXT)) {
      parts.push({
        text: text.slice(match.index + 1, match.index + 1 + match[1].length),
        index: match.index + 1,
      });
    }
  }
  return parts;
}

/** Retired words inside the customer-facing parts of a file. */
export function retiredWords(text, path) {
  return customerFacingText(text, path)
    .flatMap((part) =>
      [...part.text.matchAll(RETIRED)].map((match) => ({
        index: part.index + match.index,
        value: match[0],
      })),
    )
    .sort((a, b) => a.index - b.index)
    .map(({ index, value }) => ({
      path,
      line: lineAt(text, index),
      rule: "retired-word",
      value,
    }));
}

/** `primitives` is the set of element names that have a file in components/ui. */
export function checkSource(path, text, primitives) {
  const findings = [];
  if (path !== TOKEN_FILE) {
    findings.push(...matches(HEX, text, "raw-colour", path));
    findings.push(...matches(COLOUR_FUNCTION, text, "raw-colour", path));
  }
  findings.push(...matches(PALETTE, text, "palette-colour", path));
  findings.push(...arbitraryValues(text, path));
  findings.push(...matches(PROVIDER, text, "provider-name", path));
  findings.push(...retiredWords(text, path));
  if (path.endsWith(".tsx") && !path.startsWith(PRIMITIVES)) {
    findings.push(
      ...[...text.matchAll(RAW_ELEMENT)]
        .filter((match) => primitives.has(match[1]))
        .map((match) => ({
          path,
          line: lineAt(text, match.index),
          rule: "raw-element",
          value: `<${match[1]}>`,
        })),
    );
  }
  if (
    path.endsWith(".tsx") &&
    !path.startsWith(PRIMITIVES) &&
    !COMPONENT_NAME.test(basename(path))
  ) {
    findings.push({ path, rule: "file-name", value: basename(path) });
  }
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  if (lines > WARN_LINES) {
    findings.push({ path, rule: "file-length", value: String(lines), lines });
  }
  return findings;
}

/** Returns the problems with the allow list itself; an empty array means it is usable. */
export function allowListProblems(entries) {
  if (!Array.isArray(entries)) return ["the allow list must be a JSON array"];
  return entries.flatMap((entry, index) => {
    const where = `entry ${index + 1}`;
    const problems = [];
    for (const field of ["path", "rule", "value", "reason"]) {
      if (typeof entry?.[field] !== "string" || !entry[field].trim()) {
        problems.push(`${where} needs a non-empty "${field}"`);
      }
    }
    if (typeof entry?.rule === "string" && !(entry.rule in RULES)) {
      problems.push(`${where} names an unknown rule "${entry.rule}"`);
    }
    if (entry?.rule === "file-length" && !/^\d+$/.test(entry.value ?? "")) {
      problems.push(
        `${where} gives file-length a value that is not a line count`,
      );
    }
    return problems;
  });
}

const covers = (entry, finding) =>
  entry.rule === finding.rule &&
  (entry.path.endsWith("/")
    ? finding.path.startsWith(entry.path)
    : entry.path === finding.path) &&
  (entry.rule === "file-length" ||
    entry.value === "*" ||
    entry.value === finding.value);

/**
 * Sorts findings into failures and warnings. A file-length entry's value is the
 * most lines the file may grow to; `*` allows every value of a rule in a path.
 * An entry that no longer matches anything is a failure, so the list stays true.
 */
export function review(findings, entries) {
  const used = new Set();
  const failures = [];
  const warnings = [];
  for (const finding of findings) {
    const entry = entries.find((candidate) => covers(candidate, finding));
    if (entry) {
      used.add(entry);
      if (entry.rule === "file-length" && finding.lines > Number(entry.value)) {
        failures.push({
          ...finding,
          detail: `${finding.lines} lines (over its allowed ${entry.value})`,
        });
      }
      continue;
    }
    if (finding.rule === "file-length" && finding.lines <= FAIL_LINES) {
      warnings.push({
        ...finding,
        detail: `${finding.lines} lines (over ${WARN_LINES})`,
      });
    } else if (finding.rule === "file-length") {
      failures.push({
        ...finding,
        detail: `${finding.lines} lines (over ${FAIL_LINES})`,
      });
    } else {
      failures.push({ ...finding, detail: finding.value });
    }
  }
  for (const entry of entries) {
    if (used.has(entry)) continue;
    failures.push({
      path: entry.path,
      rule: "stale allow-list entry",
      detail: `${entry.rule} ${entry.value} matches nothing any more`,
      fix: `Delete it from ${relative(WEB, ALLOW_LIST)}.`,
    });
  }
  return { failures, warnings };
}

function sourceFiles(root, dir = "src") {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(root, path);
      return SOURCE.test(entry.name) ? [path] : [];
    },
  );
}

const annotate = process.env.GITHUB_ACTIONS === "true";
const encodeAnnotation = (text) =>
  text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

function print(kind, problem, root) {
  const where = problem.line ? `${problem.path}:${problem.line}` : problem.path;
  const mark = kind === "error" ? colour.red("✖") : colour.yellow("!");
  const fix = problem.fix ?? RULES[problem.rule];
  console.log(
    `  ${mark} ${colour.bold(where)} ${problem.rule}: ${problem.detail}`,
  );
  console.log(`    ${colour.dim(fix)}`);
  if (annotate) {
    const file = relative(process.cwd(), join(root, problem.path))
      .split(sep)
      .join("/");
    const line = problem.line ? `,line=${problem.line}` : "";
    console.log(
      `::${kind} file=${file}${line},title=${encodeAnnotation(`UI rules: ${problem.rule}`)}::${encodeAnnotation(`${problem.detail}. ${fix}`)}`,
    );
  }
}

/** Prints the report and returns the exit code: 1 on failures, 0 otherwise. */
export function checkUi({ root = WEB, allowList = ALLOW_LIST } = {}) {
  const entries = existsSync(allowList)
    ? JSON.parse(readFileSync(allowList, "utf8"))
    : [];
  const listProblems = allowListProblems(entries);
  if (listProblems.length) {
    console.log(
      `  ${colour.red("✖")} ${colour.bold(relative(root, allowList))} is invalid:`,
    );
    for (const problem of listProblems) console.log(`    ${problem}`);
    return 1;
  }
  const primitives = new Set(
    readdirSync(join(root, PRIMITIVES))
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => name.replace(/\.tsx$/, "")),
  );
  const files = [
    ...sourceFiles(root),
    ...EXTRA_FILES.filter((file) => existsSync(join(root, file))),
  ];
  const findings = files.flatMap((path) =>
    checkSource(path, readFileSync(join(root, path), "utf8"), primitives),
  );
  const { failures, warnings } = review(findings, entries);
  console.log(
    `UI rules: ${files.length} files, ${entries.length} allow-list entries`,
  );
  for (const problem of failures) print("error", problem, root);
  for (const problem of warnings) print("warning", problem, root);
  if (!failures.length && !warnings.length) {
    console.log(`  ${colour.green("✓")} every file follows the UI rules`);
  }
  if (failures.length || warnings.length) {
    console.log(
      `${failures.length} problem${failures.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`,
    );
  }
  return failures.length ? 1 : 0;
}

const invokedDirectly =
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  process.exitCode = checkUi();
}
