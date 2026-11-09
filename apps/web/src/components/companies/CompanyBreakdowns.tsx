import { MetricHoverCard } from "@/components/common";
import {
  BreakdownList,
  Logo,
  Panel,
  SegmentBar,
  type BreakdownItem,
  type Segment,
} from "@/components/data";
import { Delta } from "@/components/data/Delta";
import { Link } from "react-router";
import { DIRECTORY_COPY, levelLabel, METRICS, workModeLabel } from "@/content";
import type { CompanyFacets, CompanyPage } from "@/lib/api";
import { formatCount, formatShare } from "@/lib/format";

const SHOWN = 7;
const MODE_SWATCH: Record<string, string> = {
  remote: "bg-chart-1",
  hybrid: "bg-chart-3",
  onsite: "bg-chart-5",
};

function title(text: string, hint: { title: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      <MetricHoverCard title={hint.title}>{hint.text}</MetricHoverCard>
    </span>
  );
}

/** The Jobs page filtered to this company by its slug, which no other company shares. */
function jobsAt(companySlug: string, filter: string): string {
  return `/jobs?company=${encodeURIComponent(companySlug)}&${filter}`;
}

/** What a company is hiring for, at what level and where: three panels on one row. */
export function CompanyBreakdowns({
  page,
  facets,
}: {
  readonly page: CompanyPage;
  readonly facets: CompanyFacets;
}) {
  const companySlug = page.company.slug;
  const teams = new Map(page.teams.map((team) => [team.family, team]));
  const families: BreakdownItem[] = facets.families
    .slice(0, SHOWN)
    .map((family) => {
      const change = teams.get(family.value)?.change;
      return {
        key: family.value,
        label: family.label,
        value: formatCount(family.count),
        share: family.count / facets.open,
        trailing: formatShare(family.count / facets.open),
        ...(change && !change.partial
          ? { trailing: <Delta value={change.value} size="sm" /> }
          : {}),
        to: jobsAt(companySlug, `family=${family.value}`),
      };
    });
  const levels: BreakdownItem[] = facets.levels.map((level) => ({
    key: level.value,
    label: levelLabel(level.value),
    value: formatCount(level.count),
    share: level.count / facets.open,
    trailing: formatShare(level.count / facets.open),
    to: jobsAt(companySlug, `level=${level.value}`),
  }));
  const countries: BreakdownItem[] = facets.countries
    .slice(0, SHOWN)
    .map((country) => ({
      key: country.value,
      label: country.label,
      value: formatCount(country.count),
      share: country.count / facets.open,
      trailing: formatShare(country.count / facets.open),
      to: jobsAt(companySlug, `country=${country.code}`),
    }));
  const stated = facets.workModes.reduce((sum, mode) => sum + mode.count, 0);
  const modes: Segment[] = facets.workModes.map((mode) => ({
    label: workModeLabel(mode.value),
    share: stated === 0 ? 0 : mode.count / stated,
    swatch: MODE_SWATCH[mode.value] ?? "bg-chart-5",
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title={DIRECTORY_COPY.rolesByProfession}>
        <BreakdownList items={families} />
      </Panel>
      <Panel title={title(DIRECTORY_COPY.seniority, METRICS.seniority)}>
        <BreakdownList items={levels} />
      </Panel>
      <Panel
        title={title(DIRECTORY_COPY.where, METRICS.countries)}
        contentClassName="flex flex-col gap-5"
      >
        {modes.length > 0 ? <SegmentBar segments={modes} /> : null}
        <BreakdownList items={countries} />
      </Panel>
    </div>
  );
}

/** The skills a company's roles name most, each a door into that skill. */
export function CompanySkills({
  skills,
}: {
  readonly skills: CompanyFacets["skills"];
}) {
  if (skills.length === 0) return null;
  return (
    <Panel title={DIRECTORY_COPY.askedFor}>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {skills.map((skill) => {
          const body = (
            <>
              <Logo
                name={skill.label}
                domain={skill.domain}
                shape="square"
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {skill.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatCount(skill.count)}
              </span>
            </>
          );
          const shape =
            "flex items-center gap-3 rounded-lg bg-tile px-3 py-2.5";
          return (
            <li key={skill.value}>
              {skill.slug ? (
                <Link
                  to={`/skills/${skill.slug}`}
                  className={`${shape} outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring`}
                >
                  {body}
                </Link>
              ) : (
                <div className={shape}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
