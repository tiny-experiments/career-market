import { ArrowUpRight, Link2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { MetricHoverCard } from "@/components/common";
import { Logo, SignalBadge, type Signal } from "@/components/data";
import { PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobPagePayload } from "@/lib/api";
import {
  JOB_PAGE,
  METRICS,
  applyAt,
  levelLabel,
  openRoles,
  verdictDetail,
  verdictHeadline,
} from "@/content";
import { yearlyPay } from "@/lib/jobRows";
import { JobPosting } from "./JobPosting";
import {
  CompanyPanel,
  PayPanel,
  ProfessionPanel,
  SimilarRolesPanel,
} from "./JobRail";
import { TypicalWindowBar } from "./TypicalWindowBar";
import { VerdictCard } from "./VerdictCard";

function CompanyLine({ page }: { readonly page: JobPagePayload }) {
  const { company } = page.job;
  const trend = page.context.companyTrend;
  const name = <span className="text-sm font-bold">{company.name}</span>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Logo name={company.name} domain={company.domain} size="md" />
      {company.slug ? (
        <Link
          to={`/companies/${company.slug}`}
          className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {name}
        </Link>
      ) : (
        name
      )}
      {trend.available ? (
        <span className="text-small text-muted-foreground">
          {openRoles(trend.open)}
        </span>
      ) : null}
      {trend.available && trend.signal ? (
        <SignalBadge signal={trend.signal.toLowerCase() as Signal} />
      ) : null}
    </div>
  );
}

function PostingFacts({ job }: { readonly job: JobPagePayload["job"] }) {
  const pay = yearlyPay(job.salary);
  const facts = [
    job.location
      ? `${job.location}${job.moreLocations > 0 ? ` +${job.moreLocations}` : ""}`
      : null,
    // The API already words a posting's work mode.
    job.workMode,
    job.level ? levelLabel(job.level) : null,
    job.employmentType,
  ].filter((fact): fact is string => Boolean(fact));
  return (
    <>
      {facts.map((fact) => (
        <Badge key={fact} variant="flat" size="md">
          {fact}
        </Badge>
      ))}
      {pay ? (
        <Badge variant="flat" size="md" className="gap-1.5 pr-1.5">
          {pay}
          <MetricHoverCard title={METRICS.listedPay.title}>
            {METRICS.listedPay.text}
          </MetricHoverCard>
        </Badge>
      ) : null}
    </>
  );
}

/** The one outbound link on the site, and a way to pass the page along. */
function JobActions({ job }: { readonly job: JobPagePayload["job"] }) {
  const copy = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success(JOB_PAGE.linkCopied);
    });
  };
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="lg" onClick={copy}>
        <Link2 aria-hidden />
        {JOB_PAGE.copyLink}
      </Button>
      {job.applyUrl === null ? null : (
        <Button asChild size="lg">
          <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
            {applyAt(job.company.name)}
            <ArrowUpRight aria-hidden />
          </a>
        </Button>
      )}
    </div>
  );
}

/** An open role: the verdict first, then the posting, with the market beside it. */
export function JobView({ page }: { readonly page: JobPagePayload }) {
  const { job, context } = page;
  const { verdict } = context;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Jobs", to: "/jobs" },
          ...(job.company.slug
            ? [
                {
                  label: job.company.name,
                  to: `/companies/${job.company.slug}`,
                },
              ]
            : []),
        ]}
        eyebrow={<CompanyLine page={page} />}
        title={job.title}
        facts={<PostingFacts job={job} />}
        aside={<JobActions job={job} />}
      />
      <VerdictCard
        verdict={verdict.kind}
        headline={verdictHeadline(verdict)}
        summary={verdictDetail(verdict)}
      >
        {verdict.typical && verdict.ageDays !== null ? (
          <TypicalWindowBar
            ageDays={verdict.ageDays}
            typical={verdict.typical}
          />
        ) : undefined}
      </VerdictCard>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <JobPosting
          job={job}
          professionName={
            context.professionTrend.available
              ? context.professionTrend.name
              : null
          }
          className="min-w-0 flex-1"
        />
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-rail 2xl:grid 2xl:w-3xl 2xl:grid-cols-2">
          <PayPanel job={job} band={context.salaryBand} />
          <CompanyPanel company={job.company} trend={context.companyTrend} />
          <ProfessionPanel trend={context.professionTrend} />
          <SimilarRolesPanel similar={context.similar} />
        </div>
      </div>
    </>
  );
}
