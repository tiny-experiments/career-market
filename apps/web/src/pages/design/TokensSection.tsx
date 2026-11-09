import {
  DesignSection,
  Example,
  SwatchGrid,
  type SwatchSpec,
} from "@/pages/design/DesignSection";
import { cn } from "@/lib/utils";

const SURFACES: readonly SwatchSpec[] = [
  { name: "background", className: "bg-background", token: "--background" },
  {
    name: "card",
    className: "bg-card shadow-card",
    token: "--card + shadow-card",
  },
  { name: "tile", className: "bg-tile", token: "--tile" },
  {
    name: "popover",
    className: "bg-popover shadow-float",
    token: "--popover + shadow-float",
  },
  { name: "muted", className: "bg-muted", token: "--muted" },
  { name: "border", className: "bg-border", token: "--border" },
];

const INK: readonly SwatchSpec[] = [
  { name: "foreground", className: "bg-foreground", token: "--foreground" },
  { name: "subtle", className: "bg-subtle", token: "--subtle" },
  {
    name: "muted-foreground",
    className: "bg-muted-foreground",
    token: "--muted-foreground",
  },
  { name: "primary", className: "bg-primary", token: "--primary" },
  { name: "ring", className: "bg-ring", token: "--ring" },
  { name: "input", className: "bg-input", token: "--input" },
];

const MARKET: readonly SwatchSpec[] = [
  { name: "up", className: "bg-up", token: "--up" },
  { name: "up-soft", className: "bg-up-soft", token: "--up-soft" },
  { name: "down", className: "bg-down", token: "--down" },
  { name: "down-soft", className: "bg-down-soft", token: "--down-soft" },
  { name: "warn", className: "bg-warn", token: "--warn" },
  { name: "flat", className: "bg-flat", token: "--flat" },
];

const SERIES: readonly SwatchSpec[] = [
  { name: "chart-1", className: "bg-chart-1", token: "--chart-1" },
  { name: "chart-2", className: "bg-chart-2", token: "--chart-2" },
  { name: "chart-3", className: "bg-chart-3", token: "--chart-3" },
  { name: "chart-4", className: "bg-chart-4", token: "--chart-4" },
  { name: "chart-5", className: "bg-chart-5", token: "--chart-5" },
];

const TYPE = [
  {
    step: "display 38/800",
    className: "text-display font-extrabold",
    sample: "262,845",
  },
  {
    step: "h1 26/800",
    className: "text-h1 font-extrabold",
    sample: "Software Engineering",
  },
  {
    step: "h2 18/700",
    className: "text-h2 font-bold",
    sample: "Professions gaining",
  },
  {
    step: "body 15/400",
    className: "text-body",
    sample: "Open roles across 48,000+ company career pages.",
  },
  {
    step: "table 14/500 · name 14/700",
    className: "text-sm font-medium",
    sample: "Platform & Infra  16,160",
  },
  {
    step: "small 13/400",
    className: "text-small text-muted-foreground",
    sample: "Compared with a week ago.",
  },
  {
    step: "label 12/600",
    className: "text-eyebrow font-semibold text-muted-foreground",
    sample: "OPEN ROLES",
  },
  {
    step: "mono 12/600",
    className: "font-mono text-eyebrow font-semibold",
    sample: "SWE · AIML · INFRA",
  },
] as const;

const RADII = [
  { name: "rounded-sm", value: "4 px · checkboxes, kbd" },
  { name: "rounded-md", value: "6 px · small controls" },
  { name: "rounded-lg", value: "8 px · controls, tiles" },
  { name: "rounded-xl", value: "12 px · cards, hover cards" },
  { name: "rounded-full", value: "pills, logos, dots" },
] as const;

const SPACING = [4, 8, 12, 16, 24, 32, 48] as const;

function ThemeColumn({ theme }: { readonly theme: "light" | "dark" }) {
  return (
    <div
      className={cn(
        theme,
        "flex flex-col gap-5 rounded-xl bg-background p-5 text-foreground shadow-card",
      )}
    >
      <p className="text-eyebrow font-semibold text-muted-foreground">
        {theme === "dark" ? "Dark (default)" : "Light"}
      </p>
      <SwatchGrid items={SURFACES} />
      <SwatchGrid items={INK} />
      <SwatchGrid items={MARKET} />
      <SwatchGrid items={SERIES} />
    </div>
  );
}

export function TokensSection() {
  return (
    <DesignSection
      id="tokens"
      title="Tokens"
      description="Every colour, size and radius has a name in src/index.css. Dark is its own near-black scale; light is white with soft shadows. The one blue is the primary, up is green, down is red, and nothing else is coloured."
    >
      <Example
        title="Colour, both themes"
        note="shadcn names on the left column of each grid; market semantics on the right."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ThemeColumn theme="dark" />
          <ThemeColumn theme="light" />
        </div>
      </Example>

      <div className="grid gap-6 lg:grid-cols-3">
        <Example
          title="Type scale"
          note="Inter, tabular figures everywhere; Geist Mono for codes."
          className="lg:col-span-2"
        >
          <div className="flex flex-col divide-y rounded-xl bg-card shadow-card">
            {TYPE.map((row) => (
              <div
                key={row.step}
                className="flex items-baseline gap-6 px-4 py-3"
              >
                <span className="w-44 shrink-0 font-mono text-eyebrow text-muted-foreground">
                  {row.step}
                </span>
                <span className={cn("truncate", row.className)}>
                  {row.sample}
                </span>
              </div>
            ))}
          </div>
        </Example>
        <Example title="Spacing and radius" note="4-based; nothing in between.">
          <div className="flex flex-col gap-5 rounded-xl bg-card p-4 shadow-card">
            <div className="flex items-end gap-2">
              {SPACING.map((step) => (
                <div key={step} className="flex flex-col items-center gap-1">
                  <div
                    className="w-5 rounded-sm bg-primary/70"
                    style={{ height: step }}
                  />
                  <span className="text-eyebrow text-muted-foreground">
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <ul className="flex flex-col gap-2 text-small">
              {RADII.map((radius) => (
                <li key={radius.name} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "size-6 shrink-0 border border-border bg-tile",
                      radius.name,
                    )}
                  />
                  <span className="font-mono text-eyebrow">{radius.name}</span>
                  <span className="text-muted-foreground">{radius.value}</span>
                </li>
              ))}
            </ul>
            <p className="text-small text-muted-foreground">
              Rows 52 · compact rows 40 · controls 32 · nav 56 · sub-bar 46 ·
              gutters 24 · rail 320.
            </p>
          </div>
        </Example>
      </div>
    </DesignSection>
  );
}
