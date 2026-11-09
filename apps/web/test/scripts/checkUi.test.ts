import { describe, expect, it } from "vitest";
import {
  arbitraryValues,
  checkSource,
  customerFacingText,
  retiredWords,
  review,
} from "../../scripts/check-ui.mjs";

const PRIMITIVES = new Set(["button", "input", "select"]);
const rules = (findings: { rule: string }[]) => findings.map((f) => f.rule);

describe("check-ui", () => {
  it("flags raw colours, palette names and provider mentions", () => {
    const text = `<div className="bg-slate-800 text-white" style={{ color: "#0b0e13" }}>Data by krill</div>`;
    const found = checkSource("src/components/Thing.tsx", text, PRIMITIVES);
    expect(rules(found)).toEqual(
      expect.arrayContaining(["raw-colour", "palette-colour", "provider-name"]),
    );
  });

  it("flags retired words in strings and JSX text, not in code", () => {
    const text = [
      `// the estimated base comes from the back-cast`,
      `const note = point.estimated ? "Estimated history" : null;`,
      `<p>Before 2 Nov the line is a survival-corrected back-cast.</p>`,
      `<Delta value={row.estimated} />`,
      "const label = `${open} roles since the bootstrap`;",
    ].join("\n");
    const found = retiredWords(text, "src/components/Thing.tsx");
    expect(found.map((f) => [f.line, f.value])).toEqual([
      [2, "Estimated"],
      [3, "survival"],
      [3, "back-cast"],
      [5, "bootstrap"],
    ]);
    expect(
      rules(checkSource("src/components/Thing.tsx", text, PRIMITIVES)),
    ).toContain("retired-word");
    expect(
      retiredWords(`<p>Estimated pay</p>`, "index.html").map((f) => f.value),
    ).toEqual(["Estimated"]);
    expect(customerFacingText(`a = b // estimated`, "src/x.ts")).toEqual([]);
  });

  it("leaves comparisons, arrows and apostrophes in comments alone", () => {
    const text = [
      `const slow = rows.filter((p) => p.estimated < 5);`,
      `// the user's estimated pay isn't shown`,
      `/* a survival note, it's old`,
      `   and isn't used */`,
      `<p className="x">Open roles</p>`,
      `<div\n  id="a"\n>Estimated pay</div>`,
    ].join("\n");
    const found = retiredWords(text, "src/components/Thing.tsx");
    expect(found.map((f) => [f.line, f.value])).toEqual([[8, "Estimated"]]);
  });

  it("reads code as code: generics, URLs in JSX text and template literals", () => {
    const text = [
      `const [open, setOpen] = useState<boolean>(false);`,
      `const estimated = rows.length;`,
      `const m: Map<string, number> = new Map();`,
      `const backcast = 1;`,
      `const view = <div>{estimated}</div>;`,
      `const link = <p>See https://x.y estimated</p>;`,
      "const note = `${open} roles, ${count} estimated, ${last}`;",
      "const plain = `survival`;",
    ].join("\n");
    const found = retiredWords(text, "src/components/Thing.tsx");
    expect(found.map((f) => [f.line, f.value])).toEqual([
      [6, "estimated"],
      [7, "estimated"],
      [8, "survival"],
    ]);
  });

  it("flags arbitrary values but not arbitrary variants", () => {
    const text = `className="p-[13px] data-[side=top]:mt-1 focus-visible:ring-[3px]"`;
    expect(arbitraryValues(text, "x").map((f) => f.value)).toEqual([
      "p-[13px]",
      "ring-[3px]",
    ]);
  });

  it("flags raw elements and lowercase component files outside components/ui", () => {
    const found = checkSource(
      "src/components/thing.tsx",
      `<button>Go</button>`,
      PRIMITIVES,
    );
    expect(rules(found)).toEqual(
      expect.arrayContaining(["raw-element", "file-name"]),
    );
    const vendored = checkSource(
      "src/components/ui/button.tsx",
      `<button>Go</button>`,
      PRIMITIVES,
    );
    expect(rules(vendored)).toEqual([]);
  });

  it("leaves the token file alone", () => {
    const found = checkSource("src/index.css", `--up: #22c55e;`, PRIMITIVES);
    expect(found).toEqual([]);
  });

  it("honours the allow list and reports entries that match nothing", () => {
    const findings = checkSource(
      "src/components/Thing.tsx",
      `className="p-[13px]"`,
      PRIMITIVES,
    );
    const ok = review(findings, [
      {
        path: "src/components/Thing.tsx",
        rule: "arbitrary-value",
        value: "p-[13px]",
        reason: "x",
      },
    ]);
    expect(ok.failures).toEqual([]);
    const stale = review(
      [],
      [
        {
          path: "src/components/Gone.tsx",
          rule: "arbitrary-value",
          value: "p-[13px]",
          reason: "x",
        },
      ],
    );
    expect(stale.failures[0]?.rule).toBe("stale allow-list entry");
  });
});
