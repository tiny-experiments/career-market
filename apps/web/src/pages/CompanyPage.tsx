import { Search } from "lucide-react";
import { Link, useParams } from "react-router";
import {
  CompanyBreakdowns,
  CompanyFlowPanel,
  CompanySkills,
  CompanyTrendPanel,
  signalOf,
} from "@/components/companies";
import {
  EmptyState,
  MetricHoverCard,
  NotFoundState,
  PageSkeleton,
  ResourceView,
} from "@/components/common";
import { Delta, Logo, Panel, SignalBadge, StatCard } from "@/components/data";
import { RolesTable, type RoleRow } from "@/components/jobs";
import { PageContainer, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import {
  changeSuffix,
  companyPage as companyCopy,
  DIRECTORY_COPY,
  EMPTY,
  ERROR,
  daysOld,
  METRICS,
  NO_FIGURE,
  openRolesAt,
  PAGES,
  rankByOpenRoles,
  seeAll,
  seeAllAt,
  sentence,
  SIGNALS,
} from "@/content";
import { useResource } from "@/hooks";
import {
  companyDetail,
  companyJobs,
  type CompanyPage as CompanyPayload,
  type JobListItem,
} from "@/lib/api";
import {
  formatCount,
  formatDays,
  formatListedPay,
  formatPayRange,
  formatRelativeDays,
  formatShare,
} from "@/lib/format";
import { COMPANY_JOBS_PREVIEW } from "@/routes";

function roleRow(job: JobListItem): RoleRow {
  return {
    id: job.id,
    title: job.title,
    location: job.location,
    workMode: job.workMode,
    level: job.level,
    pay: formatListedPay(job.salary),
    posted:
      job.ageDays === null
        ? NO_FIGURE
        : sentence(formatRelativeDays(job.ageDays)),
    href: job.href,
  };
}

function CompanyHeader({ page }: { readonly page: CompanyPayload }) {
  const { company, signal, facets, change7d, change30d } = page;
  return (
    <PageHeader
      crumbs={[{ label: PAGES.companies.title, to: "/companies" }]}
      logo={<Logo name={company.name} domain={company.domain} size="lg" />}
      title={company.name}
      description={companyCopy(company.name).description}
      headline={{
        value: formatCount(company.open),
        label: DIRECTORY_COPY.openRolesUnit,
        change: (
          <span className="inline-flex flex-wrap items-center gap-2">
            {change7d ? (
              <Delta
                value={change7d.value}
                suffix={changeSuffix("week")}
                variant="pill"
              />
            ) : null}
            {change30d ? (
              <Delta
                value={change30d.value}
                suffix={changeSuffix("month")}
                variant="pill"
              />
            ) : null}
          </span>
        ),
      }}
      facts={
        <>
          {signal ? (
            <MetricHoverCard
              title={SIGNALS[signal.state].label}
              trigger={<SignalBadge signal={signalOf(signal.state)} />}
            >
              {SIGNALS[signal.state].text}
            </MetricHoverCard>
          ) : null}
          <Badge variant="flat" size="md">
            {rankByOpenRoles(formatCount(company.rank))}
          </Badge>
        </>
      }
      aside={
        facets ? (
          <div className="grid grid-cols-2 gap-2 xl:w-96">
            <StatCard
              label={METRICS.remoteShare.title}
              value={
                facets.remoteShare === null
                  ? NO_FIGURE
                  : formatShare(facets.remoteShare)
              }
              hint={{ text: METRICS.remoteShare.text }}
            />
            <StatCard
              label={METRICS.companyPay.title}
              value={
                facets.pay
                  ? formatPayRange(facets.pay.low, facets.pay.high)
                  : NO_FIGURE
              }
              hint={{ text: METRICS.companyPay.text }}
            />
            <StatCard
              label={METRICS.typicalAge.title}
              value={
                facets.medianDaysOpen === null
                  ? NO_FIGURE
                  : daysOld(formatDays(facets.medianDaysOpen))
              }
              hint={{ text: METRICS.typicalAge.text }}
            />
            <StatCard
              label={METRICS.topProfession.title}
              value={facets.families[0]?.label ?? NO_FIGURE}
              hint={{ text: METRICS.topProfession.text }}
            />
          </div>
        ) : undefined
      }
    />
  );
}

function CompanyBody({
  page,
  slug,
}: {
  readonly page: CompanyPayload;
  readonly slug: string;
}) {
  const jobs = useResource(
    companyJobs(slug, { page: 1, pageSize: COMPANY_JOBS_PREVIEW }),
  );
  const name = page.company.name;
  const total = jobs.data?.total ?? page.company.open;
  const hasFlow = page.flow !== null;

  return (
    <>
      <CompanyHeader page={page} />
      <div className={hasFlow ? "grid gap-4 lg:grid-cols-3" : "grid gap-4"}>
        <CompanyTrendPanel name={name} series={page.series} />
        <CompanyFlowPanel page={page} />
      </div>
      {page.facets ? (
        <>
          <CompanyBreakdowns page={page} facets={page.facets} />
          <CompanySkills skills={page.facets.skills} />
        </>
      ) : null}
      <Panel
        title={DIRECTORY_COPY.openRolesTable}
        action={
          <Link
            to={`/jobs?company=${encodeURIComponent(page.company.slug)}`}
            aria-label={seeAllAt(name)}
            className="rounded-sm text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {seeAll(total)}
          </Link>
        }
        contentClassName="px-0"
      >
        <ResourceView
          state={jobs}
          skeleton={<PageSkeleton withHeader={false} />}
          errorTitle={ERROR.jobs.title}
          isEmpty={(result) => result.items.length === 0}
          empty={
            <EmptyState
              icon={Search}
              title={EMPTY.companyJobs.title}
              description={EMPTY.companyJobs.description}
            />
          }
        >
          {(result) => (
            <RolesTable
              roles={result.items.map(roleRow)}
              caption={openRolesAt(name)}
            />
          )}
        </ResourceView>
      </Panel>
    </>
  );
}

export function CompanyPage() {
  const { slug = "" } = useParams();
  const company = useResource(companyDetail(slug));

  return (
    <PageContainer>
      <ResourceView
        state={company}
        skeleton={<PageSkeleton variant="detail" />}
        errorTitle={ERROR.company.title}
        notFound={<NotFoundState />}
      >
        {(page) => <CompanyBody page={page} slug={slug} />}
      </ResourceView>
    </PageContainer>
  );
}
