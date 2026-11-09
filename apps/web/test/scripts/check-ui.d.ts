declare module "../../scripts/check-ui.mjs" {
  export interface Finding {
    path: string;
    line?: number;
    rule: string;
    value: string;
    lines?: number;
  }
  export interface AllowEntry {
    path: string;
    rule: string;
    value: string;
    reason: string;
  }
  export const RULES: Record<string, string>;
  export function arbitraryValues(text: string, path: string): Finding[];
  export function checkSource(
    path: string,
    text: string,
    primitives: Set<string>,
  ): Finding[];
  export function allowListProblems(entries: unknown): string[];
  export function review(
    findings: Finding[],
    entries: AllowEntry[],
  ): {
    failures: (Finding & { detail: string })[];
    warnings: (Finding & { detail: string })[];
  };
  export function checkUi(options?: {
    root?: string;
    allowList?: string;
  }): number;
}
