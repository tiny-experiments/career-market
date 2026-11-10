import { useSearchParams } from "react-router";
import { PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { MiniList, MiniRow } from "@/components/data";
import {
  ProfessionListCard,
  ProfessionsBoard,
  professionItems,
} from "@/components/market";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ERROR, MARKET_COPY, NO_FIGURE, PAGES } from "@/content";
import { useIsMobile, useResource } from "@/hooks";
import { professionsIndex } from "@/lib/api";
import { formatCount, formatPayRange } from "@/lib/format";
import {
  bestPaidProfessions,
  coolingProfessions,
  gainingProfessions,
  PROFESSION_REGIONS,
  professionRegionFrom,
  type ProfessionRow,
} from "@/lib/professions";

const WORLDWIDE = "worldwide";

export function ProfessionsPage() {
  const [search, setSearch] = useSearchParams();
  const region = professionRegionFrom(search);
  const professions = useResource(professionsIndex(region));
  const mobile = useIsMobile();

  const chooseRegion = (next: string) =>
    setSearch((current) => {
      const params = new URLSearchParams(current);
      if (next === WORLDWIDE) params.delete("region");
      else params.set("region", next);
      return params;
    });

  const viewLink = (name: string) => {
    const params = new URLSearchParams({ view: name });
    if (region) params.set("region", region);
    return `/professions?${params.toString()}`;
  };

  return (
    <PageContainer>
      <PageHeader
        title={PAGES.professions.title}
        aside={
          <Select value={region ?? WORLDWIDE} onValueChange={chooseRegion}>
            <SelectTrigger
              aria-label={MARKET_COPY.region}
              className="h-control w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WORLDWIDE}>{MARKET_COPY.worldwide}</SelectItem>
              {PROFESSION_REGIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <ResourceView
        state={professions}
        skeleton={<PageSkeleton variant="market" withHeader={false} />}
        errorTitle={ERROR.professions.title}
      >
        {({ rows }) => {
          const lists = [
            {
              title: MARKET_COPY.gaining,
              to: viewLink("gaining"),
              rows: gainingProfessions(rows),
              value: (row: ProfessionRow) => formatCount(row.open),
              change: (row: ProfessionRow) => row.change?.value,
              empty: MARKET_COPY.noneGaining,
            },
            {
              title: MARKET_COPY.cooling,
              to: viewLink("cooling"),
              rows: coolingProfessions(rows),
              value: (row: ProfessionRow) => formatCount(row.open),
              change: (row: ProfessionRow) => row.change?.value,
              empty: MARKET_COPY.noneCooling,
            },
            {
              title: MARKET_COPY.bestPaid,
              to: viewLink("best-paid"),
              rows: bestPaidProfessions(rows),
              value: (row: ProfessionRow) =>
                row.pay ? formatPayRange(row.pay.low, row.pay.high) : NO_FIGURE,
              change: undefined,
              empty: MARKET_COPY.noPay,
            },
          ];
          return (
            <>
              {mobile ? (
                <MiniRow label={PAGES.professions.title}>
                  {lists.map((list) => (
                    <MiniList
                      key={list.title}
                      title={list.title}
                      to={list.to}
                      items={professionItems(list.rows, list)}
                      empty={list.empty}
                    />
                  ))}
                </MiniRow>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {lists.map((list) => (
                    <ProfessionListCard
                      key={list.title}
                      title={list.title}
                      to={list.to}
                      rows={list.rows}
                      value={list.value}
                      {...(list.change ? { change: list.change } : {})}
                      empty={list.empty}
                    />
                  ))}
                </div>
              )}
              <ProfessionsBoard
                key={region ?? ""}
                rows={rows}
                regional={region !== undefined}
              />
            </>
          );
        }}
      </ResourceView>
    </PageContainer>
  );
}
