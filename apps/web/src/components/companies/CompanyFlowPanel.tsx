import { MetricHoverCard } from "@/components/common";
import { Panel, SegmentBar } from "@/components/data";
import { DIRECTORY_COPY, lastDays, METRICS } from "@/content";
import type { CompanyPage } from "@/lib/api";
import { formatCount } from "@/lib/format";

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly hint: string;
  readonly tone: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-tile px-3.5 py-3">
      <span className="inline-flex items-center gap-1.5 text-eyebrow font-semibold text-muted-foreground">
        {label}
        <MetricHoverCard title={label}>{hint}</MetricHoverCard>
      </span>
      <span className={`text-h2 font-bold ${tone}`}>{formatCount(value)}</span>
    </div>
  );
}

/** Roles opened against roles closed, and the plain reading of the two. */
export function CompanyFlowPanel({ page }: { readonly page: CompanyPage }) {
  const { flow, explainer } = page;
  if (flow === null) return null;
  const moved = flow.opened + flow.closed;
  const openedShare = moved === 0 ? 0.5 : flow.opened / moved;

  return (
    <Panel
      title={DIRECTORY_COPY.hiringFlow}
      action={
        <span className="text-xs text-muted-foreground">
          {lastDays(flow.windowDays)}
        </span>
      }
      contentClassName="flex flex-col gap-5"
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure
          label={METRICS.openings.title}
          value={flow.opened}
          hint={METRICS.openings.text}
          tone="text-up"
        />
        <Figure
          label={METRICS.closings.title}
          value={flow.closed}
          hint={METRICS.closings.text}
          tone="text-down"
        />
      </div>
      <SegmentBar
        segments={[
          {
            label: METRICS.openings.title,
            share: openedShare,
            swatch: "bg-up",
          },
          {
            label: METRICS.closings.title,
            share: 1 - openedShare,
            swatch: "bg-down",
          },
        ]}
      />
      <p className="text-body text-muted-foreground">{explainer}</p>
    </Panel>
  );
}
