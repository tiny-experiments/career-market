import { Link, useParams } from "react-router";
import { NotFoundState, PageSkeleton, ResourceView } from "@/components/common";
import { Delta, Logo, Panel, StatCard } from "@/components/data";
import { RolesTable, type RoleRow } from "@/components/jobs";
import { PageContainer, PageHeader } from "@/components/layout";
import {
  SkillBreakdowns,
  SkillCompaniesTable,
  SkillPeersPanel,
  SkillTrendPanel,
} from "@/components/skills";
import { Badge } from "@/components/ui/badge";
import {
  changeSuffix,
  DIRECTORY_COPY,
  ERROR,
  latestJobsNaming,
  METRICS,
  NO_FIGURE,
  PAGES,
  rankByOpenRoles,
  seeAll,
  sentence,
  shareOf,
  skillPage as skillCopy,
} from "@/content";
import { useResource } from "@/hooks";
import { skillDetail, type SkillPagePayload } from "@/lib/api";
import {
  formatCount,
  formatMoneyRange,
  formatPay,
  formatPayRange,
  formatRelativeDays,
  formatShare,
} from "@/lib/format";

function roleRow(role: SkillPagePayload["latestRoles"][number]): RoleRow {
  return {
    id: role.id,
    title: role.title,
    company: role.company,
    location: role.location,
    pay: role.salary
      ? formatMoneyRange(role.salary.min, role.salary.max, role.salary.currency)
      : null,
    posted: sentence(formatRelativeDays(role.ageDays)),
    href: `/jobs/${role.id}`,
  };
}

function SkillHeader({ page }: { readonly page: SkillPagePayload }) {
  const lift = page.salaryEffect.available ? page.salaryEffect.delta : null;
  return (
    <PageHeader
      crumbs={[{ label: PAGES.skills.title, to: "/skills" }]}
      logo={
        <Logo name={page.label} domain={page.domain} shape="square" size="lg" />
      }
      title={page.label}
      description={skillCopy(page.label).description}
      headline={{
        value: formatCount(page.totalOpen),
        label: DIRECTORY_COPY.openRolesUnit,
        change: (
          <span className="inline-flex flex-wrap items-center gap-2">
            {page.change7d ? (
              <Delta
                value={page.change7d.value}
                suffix={changeSuffix("week")}
                variant="pill"
              />
            ) : null}
            {page.change ? (
              <Delta
                value={page.change.value}
                suffix={changeSuffix("month")}
                variant="pill"
              />
            ) : null}
          </span>
        ),
      }}
      facts={
        <>
          <Badge variant="flat" size="md">
            {page.category}
          </Badge>
          {page.rank === null ? null : (
            <Badge variant="flat" size="md">
              {rankByOpenRoles(formatCount(page.rank))}
            </Badge>
          )}
        </>
      }
      aside={
        <div className="grid grid-cols-2 gap-2 xl:w-96">
          <StatCard
            label={METRICS.skillPayRange.title}
            value={
              page.pay ? formatPayRange(page.pay.low, page.pay.high) : NO_FIGURE
            }
            hint={{ text: METRICS.skillPayRange.text }}
          />
          <StatCard
            label={METRICS.payLift.title}
            value={
              lift === null
                ? NO_FIGURE
                : `${lift < 0 ? "−" : "+"}${formatPay(Math.abs(lift))}`
            }
            hint={{ text: METRICS.payLift.text }}
          />
          <StatCard
            label={METRICS.remoteShare.title}
            value={
              page.remoteShare === null
                ? NO_FIGURE
                : formatShare(page.remoteShare)
            }
            hint={{ text: METRICS.remoteShare.text }}
          />
          <StatCard
            label={shareOf(page.primary.name)}
            value={formatShare(page.primary.share)}
            hint={{ text: METRICS.professionShare.text }}
          />
        </div>
      }
    />
  );
}

function SkillBody({ page }: { readonly page: SkillPagePayload }) {
  return (
    <>
      <SkillHeader page={page} />
      <div className="grid gap-4 lg:grid-cols-3">
        <SkillTrendPanel page={page} />
        <SkillPeersPanel page={page} />
      </div>
      <SkillBreakdowns page={page} />
      {page.companies.length > 0 ? (
        <Panel title={DIRECTORY_COPY.whoIsHiring} contentClassName="px-0">
          <SkillCompaniesTable companies={page.companies} />
        </Panel>
      ) : null}
      {page.latestRoles.length > 0 ? (
        <Panel
          title={DIRECTORY_COPY.latestJobs}
          action={
            <Link
              to={`/jobs?skill=${encodeURIComponent(page.id)}`}
              className="rounded-sm text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {seeAll(page.totalOpen)}
            </Link>
          }
          contentClassName="px-0"
        >
          <RolesTable
            roles={page.latestRoles.map(roleRow)}
            caption={latestJobsNaming(page.label)}
          />
        </Panel>
      ) : null}
    </>
  );
}

export function SkillPage() {
  const { slug = "" } = useParams();
  const skill = useResource(skillDetail(slug));

  return (
    <PageContainer>
      <ResourceView
        state={skill}
        skeleton={<PageSkeleton variant="detail" />}
        errorTitle={ERROR.skill.title}
        notFound={<NotFoundState />}
      >
        {(page) => <SkillBody page={page} />}
      </ResourceView>
    </PageContainer>
  );
}
