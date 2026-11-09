import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { MetricHoverCard } from "@/components/common";
import {
  Delta,
  Logo,
  Panel,
  SignalBadge,
  Sparkline,
  type Signal,
} from "@/components/data";
import { Badge } from "@/components/ui/badge";
import type { JobPagePayload } from "@/lib/api";
import { JOB_PAGE, METRICS, PAY_POSITION, openRoles } from "@/content";
import { formatPay } from "@/lib/format";
import { yearlyPay } from "@/lib/jobRows";
import { cn } from "@/lib/utils";

type Job = JobPagePayload["job"];
type Context = JobPagePayload["context"];

const SPARK_WIDTH = 248;
const SPARK_HEIGHT = 48;

function PanelLink({
  to,
  children,
}: {
  readonly to: string;
  readonly children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-small font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <ChevronRight className="size-3.5" aria-hidden />
    </Link>
  );
}

const BAND_TONE = {
  "below band": "warn",
  "below median": "flat",
  "at market median": "flat",
  "above median": "up",
  "above band": "up",
} as const;

export function PayPanel({
  job,
  band,
}: {
  readonly job: Job;
  readonly band: Context["salaryBand"];
}) {
  const pay = yearlyPay(job.salary);
  return (
    <Panel title="Pay">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-h1 font-extrabold">
            {pay ?? JOB_PAGE.notListed}
          </span>
          {pay === null ? (
            <span className="text-small text-muted-foreground">
              {JOB_PAGE.noPay}
            </span>
          ) : null}
        </div>
        {band.available ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Badge variant={BAND_TONE[band.verdict]} size="md">
                {PAY_POSITION[band.verdict]}
              </Badge>
              <MetricHoverCard title={METRICS.payVersusRange.title}>
                {METRICS.payVersusRange.text}
              </MetricHoverCard>
            </div>
            <div className="relative h-2 rounded-full bg-primary/25">
              <span className="absolute inset-y-0 left-1/2 w-px bg-primary" />
              <span
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
                style={{ left: `${band.position * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatPay(band.p25)}</span>
              <span>{formatPay(band.p50)}</span>
              <span>{formatPay(band.p75)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

const SIGNAL_OF: Record<string, Signal> = {
  RAMPING: "ramping",
  STEADY: "steady",
  COOLING: "cooling",
  FREEZING: "freezing",
};

export function CompanyPanel({
  company,
  trend,
}: {
  readonly company: Job["company"];
  readonly trend: Context["companyTrend"];
}) {
  const jobsHref = `/jobs?company=${encodeURIComponent(company.slug ?? company.id)}`;
  return (
    <Panel title="Company">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Logo name={company.name} domain={company.domain} size="lg" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold">{company.name}</span>
            {trend.available ? (
              <span className="text-small text-muted-foreground">
                {openRoles(trend.open)}
              </span>
            ) : null}
          </div>
          {trend.available && trend.signal ? (
            <SignalBadge
              signal={SIGNAL_OF[trend.signal] ?? "steady"}
              className="ml-auto"
            />
          ) : null}
        </div>
        {trend.available && trend.spark.length > 1 ? (
          <Sparkline
            values={trend.spark}
            width={SPARK_WIDTH}
            height={SPARK_HEIGHT}
            className="w-full"
          />
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <PanelLink to={jobsHref}>{JOB_PAGE.seeCompanyJobs}</PanelLink>
          {company.slug ? (
            <PanelLink to={`/companies/${company.slug}`}>
              {JOB_PAGE.companyPage}
            </PanelLink>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

export function ProfessionPanel({
  trend,
}: {
  readonly trend: Context["professionTrend"];
}) {
  if (!trend.available) return null;
  return (
    <Panel title="Profession">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="truncate">{trend.name}</span>
              <Badge variant="code">{trend.code}</Badge>
            </span>
            <span className="text-small text-muted-foreground">
              {openRoles(trend.open)}
            </span>
          </div>
          {trend.change === null ? null : (
            <Delta value={trend.change.value} suffix="this week" size="sm" />
          )}
        </div>
        {trend.spark.length > 1 ? (
          <Sparkline
            values={trend.spark}
            width={SPARK_WIDTH}
            height={SPARK_HEIGHT}
            className="w-full"
          />
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <PanelLink to={`/jobs?family=${trend.family}`}>
            {JOB_PAGE.seeProfessionJobs}
          </PanelLink>
          <PanelLink to={`/professions/${trend.code.toLowerCase()}`}>
            {JOB_PAGE.professionPage}
          </PanelLink>
        </div>
      </div>
    </Panel>
  );
}

export function SimilarRolesPanel({
  similar,
  className,
}: {
  readonly similar: Context["similar"];
  readonly className?: string;
}) {
  if (!similar.available) return null;
  return (
    <Panel title={JOB_PAGE.similar} {...(className ? { className } : {})}>
      <ul className="-mx-2 flex flex-col">
        {similar.roles.map((role) => (
          <li key={role.id}>
            <Link
              to={`/jobs/${encodeURIComponent(role.id)}`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 outline-none",
                "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Logo
                name={role.company.name}
                domain={role.company.domain}
                size="sm"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                  {role.title}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[role.company.name, role.location]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {role.salaryLabel ? (
                <span className="shrink-0 text-xs font-semibold">
                  {role.salaryLabel}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
