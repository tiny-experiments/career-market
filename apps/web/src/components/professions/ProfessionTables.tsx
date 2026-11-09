import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { DataTable, type Column } from "@/components/data/DataTable";
import { Logo } from "@/components/data/Logo";
import { ShareBar } from "@/components/data/ShareBar";
import { SignalBadge, type Signal } from "@/components/data/SignalBadge";
import { TablePanel } from "@/components/data/TablePanel";
import { ChangeCell } from "@/components/market/ChangeCell";
import { Button } from "@/components/ui/button";
import type { ProfessionPage } from "@/lib/api";
import { skillDomain } from "@cm/core/skills";
import { formatCount, formatRelativeDays, formatShare } from "@/lib/format";
import { METRICS, NO_FIGURE, seeAll, sentence, WINDOW_HEADER } from "@/content";

type CompanyRow = Extract<
  ProfessionPage["topCompanies"],
  readonly unknown[]
>[number];
type SkillRow = ProfessionPage["skills"][number];
type JobRow = ProfessionPage["latestRoles"][number];

const dash = <span className="text-subtle">{NO_FIGURE}</span>;

const COMPANY_COLUMNS: Column<CompanyRow>[] = [
  {
    key: "rank",
    header: "#",
    className: "w-12 text-muted-foreground",
    cell: (row) => row.rank,
  },
  {
    key: "name",
    header: "Company",
    cell: (row) => (
      <span className="flex items-center gap-3">
        <Logo name={row.name} domain={row.domain} size="sm" />
        <span className="truncate font-bold">{row.name}</span>
      </span>
    ),
  },
  {
    key: "open",
    header: "Open roles",
    align: "right",
    cell: (row) => formatCount(row.open),
  },
  {
    key: "change",
    header: WINDOW_HEADER.week,
    align: "right",
    hint: METRICS.changeWeek,
    cell: (row) => (
      <ChangeCell
        value={row.coverageJump ? null : (row.change?.value ?? null)}
      />
    ),
  },
  {
    key: "signal",
    header: "Signal",
    align: "right",
    from: "sm",
    hint: METRICS.signal,
    cell: (row) =>
      row.state ? (
        <SignalBadge signal={row.state.toLowerCase() as Signal} />
      ) : (
        dash
      ),
  },
];

const skillColumns = (withChange: boolean): Column<SkillRow>[] => [
  {
    key: "rank",
    header: "#",
    className: "w-12 text-muted-foreground",
    cell: (_row, index) => index + 1,
  },
  {
    key: "name",
    header: "Skill",
    cell: (row) => (
      <span className="flex items-center gap-3">
        <Logo
          name={row.label}
          domain={skillDomain(row.id)}
          shape="square"
          size="sm"
        />
        <span className="truncate font-bold">{row.label}</span>
      </span>
    ),
  },
  {
    key: "open",
    header: "Open roles",
    align: "right",
    cell: (row) => formatCount(row.open),
  },
  {
    key: "share",
    header: "Share of roles",
    align: "right",
    from: "sm",
    hint: METRICS.skillShare,
    cell: (row) => (
      <span className="ml-auto flex w-16 flex-col items-end gap-1">
        {formatShare(row.share)}
        <ShareBar value={row.share} />
      </span>
    ),
  },
  ...(withChange
    ? [
        {
          key: "change",
          header: WINDOW_HEADER.week,
          align: "right",
          hint: METRICS.skillChange,
          cell: (row) => <ChangeCell value={row.change} />,
        } satisfies Column<SkillRow>,
      ]
    : []),
];

const JOB_COLUMNS: Column<JobRow>[] = [
  {
    key: "title",
    header: "Role",
    cell: (row) => <span className="line-clamp-1 font-bold">{row.title}</span>,
  },
  {
    key: "company",
    header: "Company",
    from: "sm",
    cell: (row) => (
      <span className="flex items-center gap-2">
        <Logo name={row.company} domain={row.companyDomain} size="sm" />
        <span className="truncate font-medium">{row.company}</span>
      </span>
    ),
  },
  {
    key: "location",
    header: "Location",
    from: "md",
    cell: (row) => row.location ?? dash,
  },
  {
    key: "mode",
    header: "Work mode",
    from: "lg",
    cell: (row) => row.workMode ?? dash,
  },
  {
    key: "pay",
    header: "Pay",
    align: "right",
    from: "lg",
    cell: (row) => row.salary ?? dash,
  },
  {
    key: "posted",
    header: "Posted",
    align: "right",
    cell: (row) => sentence(formatRelativeDays(row.ageDays)),
  },
];

/** Who is hiring, what they ask for and the newest roles, each full width. */
export function ProfessionTables({ page }: { readonly page: ProfessionPage }) {
  const companies = Array.isArray(page.topCompanies) ? page.topCompanies : [];
  const withSkillChange = page.skills.some((skill) => skill.change !== null);

  return (
    <>
      {companies.length > 0 ? (
        <TablePanel title="Companies hiring">
          <DataTable
            caption={`Companies hiring in ${page.longName}`}
            columns={COMPANY_COLUMNS}
            rows={companies}
            rowKey={(row) => row.id}
            rowHref={(row) =>
              row.slug
                ? `/companies/${row.slug}`
                : `/jobs?company=${encodeURIComponent(row.id)}`
            }
            linkColumn="name"
          />
        </TablePanel>
      ) : null}
      {page.skills.length > 0 ? (
        <TablePanel title="Skills in demand">
          <DataTable
            caption={`Skills in demand in ${page.longName}`}
            columns={skillColumns(withSkillChange)}
            rows={page.skills}
            rowKey={(row) => row.id}
            rowHref={(row) => `/skills/${row.slug}`}
            linkColumn="name"
          />
        </TablePanel>
      ) : null}
      {page.latestRoles.length > 0 ? (
        <TablePanel
          title="Latest jobs"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to={`/jobs?family=${page.family}`}>
                {seeAll(page.open)}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        >
          <DataTable
            caption={`Latest jobs in ${page.longName}`}
            columns={JOB_COLUMNS}
            rows={page.latestRoles}
            rowKey={(row) => row.id}
            rowHref={(row) => `/jobs/${row.id}`}
            linkColumn="title"
          />
        </TablePanel>
      ) : null}
    </>
  );
}
