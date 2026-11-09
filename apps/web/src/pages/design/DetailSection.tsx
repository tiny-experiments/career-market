import { MapPin } from "lucide-react";
import { useState } from "react";
import {
  AreaChart,
  Delta,
  Legend,
  Logo,
  Panel,
  RangeTabs,
  RankedList,
  SegmentBar,
  StatCard,
} from "@/components/data";
import { VerdictCard } from "@/components/jobs";
import { PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { DesignSection, Example } from "@/pages/design/DesignSection";
import {
  SENIORITY,
  SPECIALTIES,
  SWE_SERIES,
  WHERE,
} from "@/pages/design/sampleData";

const RANGES = [
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
] as const;
type Range = (typeof RANGES)[number]["value"];

export function DetailSection() {
  const [range, setRange] = useState<Range>("3m");

  return (
    <DesignSection
      id="detail"
      title="Detail page"
      description="A header that breathes, a rail of facts, a full-width chart with its range, then panels on one row. Dates never qualify a change; the hover card explains it."
    >
      <Example title="Profession header and facts rail">
        <div className="rounded-xl bg-card p-6 shadow-card">
          <PageHeader
            crumbs={[{ label: "Professions", to: "/professions" }]}
            logo={<Logo name="Software Engineering" shape="square" size="lg" />}
            title="Software Engineering"
            code="SWE"
            headline={{
              value: "99,923",
              label: "open roles",
              change: <Delta value={0.037} suffix="this week" variant="pill" />,
            }}
            facts={
              <>
                <Badge variant="outline" size="md">
                  1D <Delta value={0.004} size="sm" className="ml-1" />
                </Badge>
                <Badge variant="outline" size="md">
                  30D <Delta value={0.151} size="sm" className="ml-1" />
                </Badge>
                <Badge variant="outline" size="md">
                  90D <Delta value={0.2} size="sm" className="ml-1" />
                </Badge>
              </>
            }
            aside={
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                  label="Pay range (US)"
                  value="$144K–$157K"
                  detail="senior roles"
                  hint={{
                    text: "The middle half of listed pay for senior roles in the United States.",
                  }}
                />
                <StatCard
                  label="Remote"
                  value="27%"
                  detail="of roles that say"
                  hint={{
                    text: "The share of open roles that say they are remote.",
                  }}
                />
                <StatCard
                  label="Typical time open"
                  value="42 days"
                  detail="median"
                  hint={{
                    text: "How long the middle role in this profession stays open.",
                  }}
                />
                <StatCard
                  label="Companies hiring"
                  value="9,815"
                  detail={<Delta value={0.0116} suffix="this week" size="sm" />}
                />
              </div>
            }
          />
        </div>
      </Example>

      <Example title="Chart panel and three panels on one row">
        <div className="flex flex-col gap-4">
          <Panel
            title="Open roles"
            action={
              <RangeTabs value={range} onChange={setRange} options={RANGES} />
            }
            contentClassName="flex flex-col gap-3"
          >
            <AreaChart
              series={SWE_SERIES}
              label="Open Software roles over the last 90 days"
            />
            <Legend
              items={[{ label: "Open roles", swatch: "bg-primary" }]}
            />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Specialties">
              <RankedList
                items={SPECIALTIES.map((item, index) => ({
                  rank: index + 1,
                  name: item.name,
                  value: formatCount(item.openRoles),
                  change: item.change7d,
                  to: `/professions/swe?specialty=${item.name.toLowerCase()}`,
                }))}
              />
            </Panel>
            <Panel title="Seniority">
              <SegmentBar segments={SENIORITY} />
            </Panel>
            <Panel
              title="Where"
              action={
                <Button variant="link" size="sm" className="px-0">
                  <MapPin />
                  Map
                </Button>
              }
            >
              <RankedList
                items={WHERE.map((item, index) => ({
                  rank: index + 1,
                  name: item.name,
                  value: formatCount(item.openRoles),
                  to: `/professions/swe?country=${item.name.toLowerCase()}`,
                }))}
              />
            </Panel>
          </div>
        </div>
      </Example>

      <Example
        title="Job verdict and the one outbound button"
        note="A job page opens on the verdict; the only link off the site is the apply button."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <VerdictCard
            verdict="reposted"
            summary="Posted 3 times since August; the last time it stayed open for 41 days."
            facts={[
              { label: "Times posted", value: "3" },
              { label: "Typical window", value: "41 days" },
              { label: "Open for", value: "12 days" },
            ]}
          />
          <div className="flex flex-col gap-4">
            <VerdictCard
              verdict="first-time"
              summary="First time this role has been posted; it opened 2 days ago."
            />
            <div>
              <Button size="lg">Apply on company site</Button>
            </div>
          </div>
        </div>
      </Example>
    </DesignSection>
  );
}
