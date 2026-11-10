import { useState } from "react";
import {
  Delta,
  KpiTile,
  Logo,
  MarketCard,
  MiniList,
  MiniRow,
  MiniStat,
  RankedList,
  Sparkline,
} from "@/components/data";
import { TickerStrip } from "@/components/layout";
import { formatCount } from "@/lib/format";
import { DesignSection, Example } from "@/pages/design/DesignSection";
import {
  COMPANIES,
  PROFESSIONS,
  SKILLS_RISING,
  TICKER,
} from "@/pages/design/sampleData";

const PAGE = 5;

export function MarketSection() {
  const [professionPage, setProfessionPage] = useState(1);
  const gaining = [...PROFESSIONS].sort((a, b) => b.change7d - a.change7d);
  const professionPages = Math.ceil(gaining.length / PAGE);
  const ramping = COMPANIES.filter((c) => c.signal === "ramping").sort(
    (a, b) => b.change7d - a.change7d,
  );

  return (
    <DesignSection
      id="market"
      title="Market components"
      description="The home page's cards, each a door into its own page: the market's temperature, who is gaining, who is ramping. Equal height, 16 px apart, tiles inside cards, the figures explained on hover."
    >
      <Example
        title="Ticker strip"
        note="Headline figures sliding under the nav; it pauses under the pointer."
      >
        <TickerStrip items={TICKER} className="rounded-lg border" />
      </Example>

      <Example
        title="Market cards"
        note="Status with its trend line and KPI tiles; a ranked list with a pager; a signal breakdown with its leaders."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MarketCard title="Market status" to="/">
            <div className="grid grid-cols-2 gap-2">
              <div className="row-span-2 flex flex-col items-center justify-center gap-2.5 rounded-lg bg-tile px-3 py-3 text-center">
                <span className="inline-flex items-center gap-1.5 text-eyebrow font-semibold text-muted-foreground">
                  Open roles
                </span>
                <Sparkline values={PROFESSIONS[0]?.trend ?? []} />
                <span className="text-xl font-extrabold">262,845</span>
                <Delta
                  value={0.013}
                  suffix="this week"
                  variant="pill"
                  size="sm"
                />
              </div>
              <KpiTile
                label="New today"
                value="661"
                change={0.12}
                hint={{
                  text: "Roles that opened today, compared with yesterday.",
                }}
              />
              <KpiTile
                label="Closed today"
                value="3,913"
                change={-0.04}
                hint={{
                  text: "Roles that closed today, compared with yesterday.",
                }}
              />
              <KpiTile
                label="Typical open role"
                value="38 days old"
                hint={{
                  text: "How long ago the typical open role was first posted: half are newer, half older.",
                }}
              />
              <KpiTile
                label="Pay listed"
                value="41%"
                hint={{
                  text: "The share of open roles that state a pay range.",
                }}
              />
            </div>
          </MarketCard>

          <MarketCard
            title="Professions gaining"
            to="/professions?view=gaining"
            pager={{
              page: professionPage,
              pageCount: professionPages,
              onPrev: () => setProfessionPage((p) => Math.max(1, p - 1)),
              onNext: () =>
                setProfessionPage((p) => Math.min(professionPages, p + 1)),
            }}
          >
            <RankedList
              items={gaining
                .slice((professionPage - 1) * PAGE, professionPage * PAGE)
                .map((row, index) => ({
                  rank: (professionPage - 1) * PAGE + index + 1,
                  logo: <Logo name={row.name} shape="square" size="sm" />,
                  name: row.name,
                  code: row.code,
                  value: formatCount(row.openRoles),
                  change: row.change7d,
                  to: `/professions/${row.code.toLowerCase()}`,
                }))}
            />
          </MarketCard>

          <MarketCard title="Companies ramping" to="/companies?signal=ramping">
            <div className="grid grid-cols-3 gap-2">
              <KpiTile
                label="Ramping"
                value={<span className="text-up">214</span>}
              />
              <KpiTile label="Steady" value="3,310" />
              <KpiTile
                label="Cooling"
                value={<span className="text-down">288</span>}
              />
            </div>
            <RankedList
              items={ramping.slice(0, 4).map((row, index) => ({
                rank: index + 1,
                logo: <Logo name={row.name} domain={row.domain} size="sm" />,
                name: row.name,
                value: formatCount(row.openRoles),
                change: row.change7d,
                to: `/companies/${row.slug}`,
              }))}
            />
          </MarketCard>
        </div>
      </Example>

      <Example
        title="On a phone"
        note="Below md the cards shrink to mini versions: a sideways row of tiles (label, figure, small change, the (i) a tap away), then the lists cut to their top three, so the table starts on the first screen."
      >
        <div className="flex max-w-sm flex-col gap-3 overflow-hidden rounded-xl border px-gutter py-4">
          <MiniRow label="The market at a glance" className="flex gap-2">
            <MiniStat
              label="Tech Hiring Index"
              value="262,845"
              change={0.013}
              suffix="this week"
              hint={{ text: "How many tech roles are open right now." }}
              to="/jobs"
            >
              <Sparkline
                values={PROFESSIONS[0]?.trend ?? []}
                width={112}
                height={18}
                className="mt-1"
              />
            </MiniStat>
            <MiniStat
              label="New today"
              value="576"
              caption="newly posted roles"
            />
            <MiniStat label="Ramping" value="214" tone="up" />
          </MiniRow>
          <MiniRow label="Biggest movers this week" className="flex gap-2">
            <MiniList
              title="Professions gaining"
              to="/professions?view=gaining"
              items={gaining.map((row, index) => ({
                rank: index + 1,
                logo: <Logo name={row.name} shape="square" size="sm" />,
                name: row.name,
                value: formatCount(row.openRoles),
                change: row.change7d,
                to: `/professions/${row.code.toLowerCase()}`,
              }))}
              empty="No profession grew this week."
            />
          </MiniRow>
        </div>
      </Example>

      <Example
        title="Skills rising"
        note="The same list shape on the Skills page, with square tiles for skills."
      >
        <div className="max-w-md rounded-xl bg-card p-4 shadow-card">
          <RankedList
            items={SKILLS_RISING.map((skill, index) => ({
              rank: index + 1,
              logo: (
                <Logo
                  name={skill.name}
                  domain={skill.domain}
                  shape="square"
                  size="sm"
                />
              ),
              name: skill.name,
              value: formatCount(skill.openRoles),
              change: skill.change7d,
              to: `/skills/${skill.slug}`,
            }))}
          />
        </div>
      </Example>
    </DesignSection>
  );
}
