import { Link } from "react-router";
import { MetricHoverCard } from "@/components/common";
import {
  AreaChart,
  Delta,
  MarketCard,
  RankedList,
  SegmentBar,
  Sparkline,
} from "@/components/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useResource } from "@/hooks";
import { JOBS_LIST, METRICS, changeSuffix } from "@/content";
import { jobsPulse, siteMeta, type JobsPulse } from "@/lib/api";
import { datedSeries } from "@/lib/charts";
import { formatCount, formatShare } from "@/lib/format";

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";
const TREND_HEIGHT = 88;

/** A day-by-day line with its values and dates; a bare line if the day is unknown. */
function PulseTrend({
  values,
  day,
  label,
}: {
  readonly values: readonly number[];
  readonly day: string | null;
  readonly label: string;
}) {
  if (values.length < 2) return null;
  if (day === null) return <Sparkline values={values} />;
  return (
    <AreaChart
      series={datedSeries(values, day)}
      height={TREND_HEIGHT}
      label={label}
    />
  );
}

function BigFigure({
  value,
  title,
  hint,
}: {
  readonly value: string;
  readonly title: string;
  readonly hint: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-display font-extrabold">{value}</span>
      <MetricHoverCard title={title}>{hint}</MetricHoverCard>
    </span>
  );
}

interface CardProps {
  readonly pulse: JobsPulse;
  readonly day: string | null;
}

function OpenRolesCard({ pulse, day }: CardProps) {
  return (
    <MarketCard title={JOBS_LIST.pulseOpen} to="/">
      <div className="flex flex-col gap-1">
        <BigFigure
          value={formatCount(pulse.open)}
          title={METRICS.openRoles.title}
          hint={METRICS.openRoles.text}
        />
        {pulse.change1w === null ? null : (
          <Delta value={pulse.change1w} suffix={changeSuffix("week")} />
        )}
      </div>
      <PulseTrend
        values={pulse.openSpark}
        day={day}
        label={JOBS_LIST.pulseOpen}
      />
      <Link
        to="/jobs?pay=listed"
        className="mt-auto text-small text-muted-foreground hover:text-foreground"
      >
        {JOBS_LIST.listPay(
          formatShare(pulse.open === 0 ? 0 : pulse.withPay / pulse.open),
        )}
      </Link>
    </MarketCard>
  );
}

function NewTodayCard({ pulse, day }: CardProps) {
  return (
    <MarketCard title={JOBS_LIST.pulseNew} to="/jobs?posted=1d">
      <BigFigure
        value={formatCount(pulse.newToday)}
        title={METRICS.newLastDay.title}
        hint={METRICS.newLastDay.text}
      />
      <PulseTrend
        values={pulse.newSpark}
        day={day}
        label={JOBS_LIST.pulseNewCaption}
      />
      <p className="mt-auto text-small text-muted-foreground">
        {JOBS_LIST.pulseNewCaption}
      </p>
    </MarketCard>
  );
}

function WorkModeCard({ pulse }: { readonly pulse: JobsPulse }) {
  const { remote, hybrid, onsite } = pulse.workModes;
  const stated = remote + hybrid + onsite || 1;
  return (
    <MarketCard title={JOBS_LIST.pulseRemote} to="/jobs?mode=remote">
      <BigFigure
        value={formatCount(remote)}
        title={METRICS.remoteRoles.title}
        hint={METRICS.remoteRoles.text}
      />
      <SegmentBar
        className="mt-auto"
        segments={[
          { label: "Remote", share: remote / stated, swatch: "bg-chart-1" },
          { label: "Hybrid", share: hybrid / stated, swatch: "bg-chart-2" },
          { label: "On-site", share: onsite / stated, swatch: "bg-chart-3" },
        ]}
      />
    </MarketCard>
  );
}

function BusiestCard({ pulse }: { readonly pulse: JobsPulse }) {
  return (
    <MarketCard title={JOBS_LIST.pulseBusiest} to="/professions">
      <RankedList
        items={pulse.professions.slice(0, 3).map((row, index) => ({
          rank: index + 1,
          name: row.name,
          value: formatCount(row.open),
          to: `/jobs?family=${row.family}`,
          ...(row.change1w === null ? {} : { change: row.change1w }),
        }))}
      />
    </MarketCard>
  );
}

/** The market at a glance, above the filters: a door into each view of the list. */
export function JobsPulseStrip() {
  const { data, error } = useResource(jobsPulse());
  // The day dates the trend lines; without it they still draw, undated.
  const meta = useResource(siteMeta());
  if (data === null && error !== null) return null;
  if (data === null || (meta.data === null && meta.error === null)) {
    return (
      <div className={GRID} role="status" aria-label="Loading">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className={GRID}>
      <OpenRolesCard pulse={data} day={meta.data?.asOf ?? null} />
      <NewTodayCard pulse={data} day={meta.data?.asOf ?? null} />
      <WorkModeCard pulse={data} />
      <BusiestCard pulse={data} />
    </div>
  );
}
