import { PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer } from "@/components/layout";
import {
  CompaniesRampingCard,
  MarketStatusCard,
  ProfessionListCard,
  ProfessionsBoard,
  WhereJobsPanel,
} from "@/components/market";
import { ERROR, MARKET_COPY, PAGES } from "@/content";
import { useResource } from "@/hooks";
import { marketOverview, professionsIndex } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { gainingProfessions } from "@/lib/professions";

const skeleton = <PageSkeleton variant="market" withHeader={false} />;

export function MarketPage() {
  const market = useResource(marketOverview());
  const professions = useResource(professionsIndex());

  return (
    <PageContainer>
      <h1 className="sr-only">{PAGES.market.title}</h1>
      <ResourceView
        state={market}
        skeleton={skeleton}
        errorTitle={ERROR.market.title}
      >
        {(overview) => (
          <ResourceView
            state={professions}
            skeleton={skeleton}
            errorTitle={ERROR.market.title}
          >
            {({ rows }) => (
              <>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <MarketStatusCard market={overview} />
                  <ProfessionListCard
                    title={MARKET_COPY.professionsGaining}
                    to="/professions?view=gaining"
                    rows={gainingProfessions(rows)}
                    value={(row) => formatCount(row.open)}
                    change={(row) => row.change?.value}
                    empty={MARKET_COPY.noneGaining}
                    comfortable
                  />
                  <CompaniesRampingCard market={overview} />
                </div>
                <section className="flex flex-col gap-4">
                  <h2 className="text-h2 font-bold">
                    {MARKET_COPY.professions}
                  </h2>
                  <ProfessionsBoard rows={rows} />
                </section>
                <WhereJobsPanel countries={overview.countries} />
              </>
            )}
          </ResourceView>
        )}
      </ResourceView>
    </PageContainer>
  );
}
