import { useMemo, useState } from "react";
import { AreaChart } from "@/components/data/AreaChart";
import { Panel } from "@/components/data/Panel";
import { RangeTabs, type RangeOption } from "@/components/data/RangeTabs";
import type { ProfessionPage } from "@/lib/api";
import { formatCount } from "@/lib/format";

type ChartRange = "1W" | "1M" | "3M" | "1Y" | "ALL";

const RANGES: readonly RangeOption<ChartRange>[] = [
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "All" },
];

const POINTS: Record<Exclude<ChartRange, "ALL">, number> = {
  "1W": 8,
  "1M": 31,
  "3M": 92,
  "1Y": 366,
};

/** Open roles over time; the range tabs choose how far back it reads. */
export function ProfessionChartPanel({
  page,
}: {
  readonly page: ProfessionPage;
}) {
  const [range, setRange] = useState<ChartRange>("3M");
  const points = useMemo(() => {
    const series = page.series.map((point) => ({
      date: point.date,
      value: point.open,
    }));
    return range === "ALL" ? series : series.slice(-POINTS[range]);
  }, [page.series, range]);

  return (
    <Panel
      title="Open roles"
      action={
        <RangeTabs
          value={range}
          onChange={setRange}
          options={RANGES}
          label="Chart range"
        />
      }
    >
      <AreaChart
        series={points}
        height={320}
        label={`Open roles in ${page.longName} over time`}
        formatValue={formatCount}
      />
    </Panel>
  );
}
