import { lazy, Suspense, useState } from "react";
import { DataTable, type Column } from "@/components/data/DataTable";
import { MARKET_COPY } from "@/content";
import { Panel } from "@/components/data/Panel";
import { ShareBar } from "@/components/data/ShareBar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatShare } from "@/lib/format";
import type { MapCountry } from "./WorldMap";

const TOP_COUNTRIES = 10;

const WorldMap = lazy(() =>
  import("./WorldMap").then((m) => ({ default: m.WorldMap })),
);

const COLUMNS: Column<MapCountry & { readonly rank: number }>[] = [
  {
    key: "rank",
    header: "#",
    className: "w-10 text-muted-foreground",
    cell: (row) => row.rank,
  },
  {
    key: "name",
    header: "Country",
    cell: (row) => <span className="font-bold">{row.name}</span>,
  },
  {
    key: "open",
    header: "Open roles",
    align: "right",
    cell: (row) => formatCount(row.open),
  },
  {
    key: "share",
    header: "Share",
    align: "right",
    cell: (row) => (
      <span className="ml-auto flex w-14 flex-col items-end gap-1">
        {formatShare(row.share)}
        <ShareBar value={row.share} />
      </span>
    ),
  },
];

/** The map and the countries behind it, each pointing at the other. */
export function WhereJobsPanel({
  countries,
}: {
  readonly countries: readonly MapCountry[];
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const rows = countries
    .slice(0, TOP_COUNTRIES)
    .map((country, index) => ({ ...country, rank: index + 1 }));

  return (
    <Panel
      title={MARKET_COPY.whereTheJobsAre}
      className="[--card-spacing:--spacing(6)]"
      contentClassName="grid items-center gap-8 xl:grid-cols-5"
    >
      <Suspense fallback={<Skeleton className="h-96 w-full xl:col-span-3" />}>
        <WorldMap
          countries={countries}
          highlight={hovered}
          className="xl:col-span-3"
        />
      </Suspense>
      <div className="-mx-gutter -mb-6 xl:col-span-2 xl:-mt-2 xl:mb-0">
        <DataTable
          caption="Open roles by country"
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.code}
          rowHref={(row) => `/jobs?country=${row.code}`}
          rowLabel={(row) => `Jobs in ${row.name}`}
          linkColumn="name"
          onRowHover={(row) => setHovered(row?.code ?? null)}
        />
      </div>
    </Panel>
  );
}
