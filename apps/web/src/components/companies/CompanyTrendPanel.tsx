import { useState } from "react";
import { History } from "lucide-react";
import { EmptyState, MetricHoverCard } from "@/components/common";
import { AreaChart, Panel, RangeTabs, type AreaPoint } from "@/components/data";
import { DIRECTORY_COPY, EMPTY, METRICS, openRolesAtOverTime } from "@/content";
import type { CompanyPage } from "@/lib/api";

type Range = "1W" | "1M" | "ALL";
const DAYS: Record<Exclude<Range, "ALL">, number> = { "1W": 7, "1M": 30 };

/** Open roles over time, with range tabs once there is more than one range to choose from. */
export function CompanyTrendPanel({
  name,
  series,
}: {
  readonly name: string;
  readonly series: CompanyPage["series"];
}) {
  const [range, setRange] = useState<Range>("ALL");
  const points: AreaPoint[] = series
    .filter((day) => !day.excluded)
    .map((day) => ({ date: day.date, value: day.open }));
  const options = [
    ...(points.length > DAYS["1W"]
      ? [{ value: "1W" as const, label: "1W" }]
      : []),
    ...(points.length > DAYS["1M"]
      ? [{ value: "1M" as const, label: "1M" }]
      : []),
    { value: "ALL" as const, label: "All" },
  ];
  const shown = range === "ALL" ? points : points.slice(-DAYS[range]);

  return (
    <Panel
      className="lg:col-span-2"
      title={
        <span className="inline-flex items-center gap-1.5">
          {DIRECTORY_COPY.openRolesChart}
          <MetricHoverCard title={METRICS.openRolesCompany.title}>
            {METRICS.openRolesCompany.text}
          </MetricHoverCard>
        </span>
      }
      action={
        options.length > 1 ? (
          <RangeTabs value={range} onChange={setRange} options={options} />
        ) : undefined
      }
    >
      {shown.length > 1 ? (
        <AreaChart
          series={shown}
          height={260}
          label={openRolesAtOverTime(name)}
        />
      ) : (
        <EmptyState
          icon={History}
          title={EMPTY.history.title}
          description={EMPTY.history.description}
        />
      )}
    </Panel>
  );
}
