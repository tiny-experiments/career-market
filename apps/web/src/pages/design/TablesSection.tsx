import { Inbox } from "lucide-react";
import { useState } from "react";
import { Chip, EmptyState } from "@/components/common";
import {
  DataTable,
  Delta,
  Logo,
  Pager,
  ShareBar,
  SignalBadge,
  Sparkline,
  type Column,
  type SortDirection,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { formatCount, formatPayRange, formatShare } from "@/lib/format";
import { DesignSection, Example } from "@/pages/design/DesignSection";
import {
  COMPANIES,
  PROFESSIONS,
  type CompanyRow,
  type ProfessionRow,
} from "@/pages/design/sampleData";

const WEEK_HINT = {
  title: "7-day change",
  text: "Change in open roles compared with a week ago.",
} as const;

const rankColumn = <Row,>(): Column<Row> => ({
  key: "rank",
  header: "#",
  className: "w-12 text-muted-foreground",
  cell: (_row, index) => index + 1,
});

const PROFESSION_COLUMNS: readonly Column<ProfessionRow>[] = [
  rankColumn<ProfessionRow>(),
  {
    key: "name",
    header: "Profession",
    cell: (row) => (
      <span className="inline-flex items-center gap-3">
        <Logo name={row.name} shape="square" size="sm" />
        <span className="inline-flex items-baseline gap-1.5">
          <span className="font-bold">{row.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {row.code}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: "openRoles",
    header: "Open roles",
    align: "right",
    sortable: true,
    cell: (row) => formatCount(row.openRoles),
  },
  {
    key: "change1d",
    header: "1D",
    align: "right",
    sortable: true,
    from: "lg",
    cell: (row) => <Delta value={row.change1d} />,
  },
  {
    key: "change7d",
    header: "7D",
    align: "right",
    sortable: true,
    hint: WEEK_HINT,
    cell: (row) => <Delta value={row.change7d} />,
  },
  {
    key: "change30d",
    header: "30D",
    align: "right",
    sortable: true,
    from: "md",
    cell: (row) => <Delta value={row.change30d} />,
  },
  {
    key: "companies",
    header: "Companies",
    align: "right",
    from: "lg",
    hint: {
      title: "Companies",
      text: "Companies with at least one open role in this profession.",
    },
    cell: (row) => formatCount(row.companies),
  },
  {
    key: "pay",
    header: "Pay range (US)",
    align: "right",
    from: "xl",
    hint: {
      title: "Pay range (US)",
      text: "The middle half of listed pay for senior roles in the United States.",
    },
    cell: (row) => formatPayRange(row.payLow, row.payHigh),
  },
  {
    key: "remote",
    header: "Remote",
    align: "right",
    from: "md",
    hint: {
      title: "Remote",
      text: "The share of open roles that say they are remote.",
    },
    cell: (row) => (
      <span className="inline-flex w-16 flex-col items-end gap-1">
        {formatShare(row.remoteShare)}
        <ShareBar value={row.remoteShare} />
      </span>
    ),
  },
  {
    key: "trend",
    header: "30 days",
    align: "right",
    from: "sm",
    cell: (row) => <Sparkline values={row.trend} />,
  },
];

const COMPANY_COLUMNS: readonly Column<CompanyRow>[] = [
  rankColumn<CompanyRow>(),
  {
    key: "name",
    header: "Company",
    cell: (row) => (
      <span className="inline-flex items-center gap-3">
        <Logo name={row.name} domain={row.domain} size="sm" />
        <span className="inline-flex items-baseline gap-1.5">
          <span className="font-bold">{row.name}</span>
          {row.domain ? (
            <span className="text-xs text-muted-foreground">{row.domain}</span>
          ) : null}
        </span>
      </span>
    ),
  },
  {
    key: "openRoles",
    header: "Open roles",
    align: "right",
    sortable: true,
    cell: (row) => formatCount(row.openRoles),
  },
  {
    key: "change7d",
    header: "7D",
    align: "right",
    sortable: true,
    hint: WEEK_HINT,
    cell: (row) => <Delta value={row.change7d} />,
  },
  {
    key: "change30d",
    header: "30D",
    align: "right",
    sortable: true,
    from: "md",
    cell: (row) => <Delta value={row.change30d} />,
  },
  {
    key: "signal",
    header: "Signal",
    align: "right",
    from: "sm",
    hint: {
      title: "Signal",
      text: "Whether a company's open roles are growing, holding, shrinking or being pulled.",
    },
    cell: (row) => <SignalBadge signal={row.signal} />,
  },
  {
    key: "top",
    header: "Top profession",
    align: "right",
    from: "lg",
    cell: (row) =>
      `${row.topProfession} · ${formatCount(row.topProfessionRoles)}`,
  },
  {
    key: "remote",
    header: "Remote",
    align: "right",
    from: "lg",
    cell: (row) => (
      <span className="inline-flex w-16 flex-col items-end gap-1">
        {formatShare(row.remoteShare)}
        <ShareBar value={row.remoteShare} />
      </span>
    ),
  },
  {
    key: "trend",
    header: "30 days",
    align: "right",
    from: "sm",
    cell: (row) => <Sparkline values={row.trend} />,
  },
];

const VIEWS = [
  "All",
  "Gaining",
  "Cooling",
  "Remote-friendly",
  "Best paid",
] as const;

export function TablesSection() {
  const [view, setView] = useState<(typeof VIEWS)[number]>("All");
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: "openRoles",
    direction: "desc",
  });
  const [loading, setLoading] = useState(false);

  const onSort = (key: string) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: "desc" },
    );
  const professions = [...PROFESSIONS]
    .filter((row) => {
      if (view === "Gaining") return row.change7d > 0;
      if (view === "Cooling") return row.change7d < 0;
      if (view === "Remote-friendly") return row.remoteShare >= 0.25;
      if (view === "Best paid") return row.payHigh >= 160_000;
      return true;
    })
    .sort((a, b) => {
      const key = sort.key as keyof ProfessionRow;
      const av = a[key];
      const bv = b[key];
      if (typeof av !== "number" || typeof bv !== "number") return 0;
      return sort.direction === "desc" ? bv - av : av - bv;
    });

  return (
    <DesignSection
      id="tables"
      title="The market table"
      description="Full width, the row is the link, numbers right-aligned in tabular figures, a sparkline per row coloured by direction and a share bar under a percentage. Hints sit behind the (i) in the header. No column is a bare link."
    >
      <Example title="Professions" note="Chips filter, headers sort.">
        <div className="-mx-gutter flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 px-gutter">
            {VIEWS.map((label) => (
              <Chip
                key={label}
                pressed={view === label}
                onClick={() => setView(label)}
              >
                {label}
              </Chip>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setLoading((l) => !l)}
            >
              {loading ? "Show rows" : "Show loading"}
            </Button>
          </div>
          <DataTable
            caption="Professions by open roles"
            columns={PROFESSION_COLUMNS}
            rows={professions}
            rowKey={(row) => row.code}
            rowHref={(row) => `/professions/${row.code.toLowerCase()}`}
            rowLabel={(row) => row.name}
            linkColumn="name"
            sort={sort}
            onSort={onSort}
            loading={loading}
            empty={
              <EmptyState
                icon={Inbox}
                title="No professions match this view"
                description="Pick another view above."
              />
            }
          />
        </div>
      </Example>

      <Example
        title="Companies"
        note="Every company with open tech roles, 50 a page, with its signal as a word."
      >
        <div className="-mx-gutter flex flex-col gap-4">
          <DataTable
            caption="Companies by open roles"
            columns={COMPANY_COLUMNS}
            rows={COMPANIES}
            rowKey={(row) => row.slug}
            rowHref={(row) => `/companies/${row.slug}`}
            rowLabel={(row) => row.name}
            linkColumn="name"
          />
          <div className="px-gutter">
            <Pager
              page={1}
              pageCount={366}
              hrefFor={(page) => `/companies?page=${page}`}
            />
          </div>
        </div>
      </Example>
    </DesignSection>
  );
}
