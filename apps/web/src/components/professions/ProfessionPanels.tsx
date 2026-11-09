import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { BreakdownList } from "@/components/data/BreakdownList";
import { Panel } from "@/components/data/Panel";
import { SegmentBar } from "@/components/data/SegmentBar";
import type { ProfessionPage } from "@/lib/api";
import { formatCount, formatShare } from "@/lib/format";
import { METRICS } from "@/content";

const LIST_ROWS = 6;
const SERIES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const;

function Title({
  hint,
}: {
  readonly hint: { readonly title: string; readonly text: string };
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {hint.title}
      <MetricHoverCard title={hint.title}>{hint.text}</MetricHoverCard>
    </span>
  );
}

/** The three parts of a profession, side by side: what, how senior, where. */
export function ProfessionPanels({ page }: { readonly page: ProfessionPage }) {
  const jobsLink = (extra: string) => `/jobs?family=${page.family}&${extra}`;
  const specialtyTotal = page.specialties.reduce((n, s) => n + s.open, 0);
  const seniority = groupSeniority(page.seniority);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title={<Title hint={METRICS.specialties} />}>
        <BreakdownList
          items={page.specialties.slice(0, LIST_ROWS).map((specialty) => ({
            key: specialty.id,
            label: specialty.label,
            value: formatCount(specialty.open),
            share: specialtyTotal ? specialty.open / specialtyTotal : 0,
            to: jobsLink(`specialty=${specialty.id}`),
          }))}
        />
      </Panel>
      <Panel
        title={<Title hint={METRICS.seniority} />}
        contentClassName="flex flex-col gap-4"
      >
        <SegmentBar
          legend={false}
          segments={seniority.map((level, index) => ({
            label: level.label,
            share: level.share,
            swatch: SERIES[index] ?? "bg-chart-5",
          }))}
        />
        <BreakdownList
          items={seniority.map((level, index) => ({
            key: level.label,
            label: level.label,
            value: formatShare(level.share),
            share: level.share,
            swatch: SERIES[index] ?? "bg-chart-5",
          }))}
        />
      </Panel>
      <Panel title={<Title hint={METRICS.countries} />}>
        <BreakdownList
          items={page.countries.slice(0, LIST_ROWS).map((country) => ({
            key: country.code,
            label: country.name,
            value: formatCount(country.open),
            share: country.share,
            to: jobsLink(`country=${country.code}`),
          }))}
        />
      </Panel>
    </div>
  );
}

/** The four largest levels by name, the rest as "Other". */
function groupSeniority(
  levels: ProfessionPage["seniority"],
): readonly { readonly label: string; readonly share: number }[] {
  const top = levels.slice(0, 4);
  const rest = levels.slice(4).reduce((n, level) => n + level.share, 0);
  return [
    ...top.map((level) => ({ label: level.label, share: level.share })),
    ...(rest > 0 ? [{ label: "Other", share: rest }] : []),
  ];
}
