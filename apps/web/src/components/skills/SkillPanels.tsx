import { useState } from "react";
import { MetricHoverCard } from "@/components/common";
import {
  AreaChart,
  BreakdownList,
  ChangeCell,
  DataTable,
  Logo,
  Panel,
  RangeTabs,
  type BreakdownItem,
  type Column,
} from "@/components/data";
import { skillLogo } from "@/components/skills/SkillRankedItems";
import {
  DIRECTORY_COPY,
  METRICS,
  openRolesNamingOverTime,
  WINDOW_HEADER,
} from "@/content";
import type { SkillPagePayload } from "@/lib/api";
import { formatCount, formatShare } from "@/lib/format";

type Company = SkillPagePayload["companies"][number];
type Range = "1M" | "3M" | "ALL";
const DAYS: Record<Exclude<Range, "ALL">, number> = { "1M": 30, "3M": 91 };
const RANGES: readonly { value: Range; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "ALL", label: "6M" },
];

function titled(text: string, hint: { title: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      <MetricHoverCard title={hint.title}>{hint.text}</MetricHoverCard>
    </span>
  );
}

/** Demand for the skill over time. */
export function SkillTrendPanel({ page }: { readonly page: SkillPagePayload }) {
  const [range, setRange] = useState<Range>("3M");
  const points = page.series.map((day) => ({
    date: day.date,
    value: day.open,
  }));
  const shown = range === "ALL" ? points : points.slice(-DAYS[range]);
  return (
    <Panel
      className="lg:col-span-2"
      title={titled(DIRECTORY_COPY.openRolesChart, METRICS.skillChart)}
      action={<RangeTabs value={range} onChange={setRange} options={RANGES} />}
    >
      <AreaChart
        series={shown}
        height={260}
        label={openRolesNamingOverTime(page.label)}
      />
    </Panel>
  );
}

/** The skill beside its closest alternatives. */
export function SkillPeersPanel({ page }: { readonly page: SkillPagePayload }) {
  const largest = Math.max(...page.peers.map((peer) => peer.open), 1);
  const items: BreakdownItem[] = page.peers.map((peer) => ({
    key: peer.id,
    label: peer.label,
    logo: skillLogo(peer),
    value: formatCount(peer.open),
    share: peer.open / largest,
    trailing: peer.self ? DIRECTORY_COPY.thisSkill : " ",
    ...(peer.slug && !peer.self ? { to: `/skills/${peer.slug}` } : {}),
  }));
  return (
    <Panel title={titled(DIRECTORY_COPY.comparedWith, METRICS.peers)}>
      <BreakdownList items={items} />
    </Panel>
  );
}

/** Where the skill is used, what it goes with. */
export function SkillBreakdowns({ page }: { readonly page: SkillPagePayload }) {
  const professions: BreakdownItem[] = page.professions.map((profession) => ({
    key: profession.family,
    label: profession.name,
    value: formatCount(profession.open),
    share: profession.share,
    trailing: formatShare(profession.share),
    to: `/professions/${profession.code.toLowerCase()}`,
  }));
  const pairs: BreakdownItem[] = page.pairs.map((pair) => ({
    key: pair.id,
    label: pair.label,
    logo: skillLogo(pair),
    value: formatCount(pair.open),
    share: pair.share,
    trailing: formatShare(pair.share),
    ...(pair.slug ? { to: `/skills/${pair.slug}` } : {}),
  }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={titled(DIRECTORY_COPY.whereUsed, METRICS.skillProfessions)}>
        <BreakdownList items={professions} />
      </Panel>
      <Panel title={titled(DIRECTORY_COPY.pairedWith, METRICS.pairedSkills)}>
        <BreakdownList items={pairs} />
      </Panel>
    </div>
  );
}

const COMPANY_COLUMNS: Column<Company>[] = [
  {
    key: "name",
    header: DIRECTORY_COPY.columns.company,
    cell: (row) => (
      <span className="inline-flex min-w-0 items-center gap-3">
        <Logo name={row.name} domain={row.domain} size="sm" />
        <span className="truncate font-bold">{row.name}</span>
      </span>
    ),
  },
  {
    key: "open",
    header: DIRECTORY_COPY.columns.openRoles,
    align: "right",
    hint: METRICS.openRolesSkill,
    cell: (row) => formatCount(row.open),
  },
  {
    key: "change",
    header: WINDOW_HEADER.month,
    align: "right",
    hint: METRICS.changeMonth,
    cell: (row) => <ChangeCell change={row.change} />,
  },
];

/** Who is hiring for the skill; a row opens the company. */
export function SkillCompaniesTable({
  companies,
}: {
  readonly companies: readonly Company[];
}) {
  return (
    <DataTable
      columns={COMPANY_COLUMNS}
      rows={companies}
      rowKey={(row) => row.id}
      rowHref={(row) => `/companies/${row.slug ?? row.id}`}
      caption={DIRECTORY_COPY.skillCompaniesCaption}
      inset="card"
    />
  );
}
