import { Delta } from "@/components/data/Delta";
import { Logo } from "@/components/data/Logo";
import { ShareBar } from "@/components/data/ShareBar";
import { StatCard } from "@/components/data/StatCard";
import { PageHeader } from "@/components/layout/PageHeader";
import type { ProfessionPage } from "@/lib/api";
import {
  formatCount,
  formatDays,
  formatPayRange,
  formatShare,
} from "@/lib/format";
import {
  changeSuffix,
  MARKET_COPY,
  daysOld,
  METRICS,
  NO_FIGURE,
  WINDOW_HEADER,
} from "@/content";
import { ChangePill } from "./ChangePill";

/** The name, the number, how it moved, and the four facts that matter about it. */
export function ProfessionHeader({ page }: { readonly page: ProfessionPage }) {
  const week = page.changes["1W"];
  const month = page.changes["1M"];
  const quarter = page.changes["3M"];
  const salary = page.salary;
  const stated = page.workMode
    ? page.workMode.remote + page.workMode.hybrid + page.workMode.onsite
    : 0;
  const remote = page.workMode && stated ? page.workMode.remote / stated : null;

  return (
    <PageHeader
      crumbs={[{ label: "Professions", to: "/professions" }]}
      logo={<Logo name={page.name} shape="square" size="lg" />}
      title={page.longName}
      code={page.code}
      headline={{
        value: formatCount(page.open),
        label: MARKET_COPY.openRolesUnit,
        ...(week
          ? {
              change: (
                <Delta
                  value={week.value}
                  suffix={changeSuffix("week")}
                  variant="pill"
                />
              ),
            }
          : {}),
      }}
      facts={
        <>
          {page.change1d === null ? null : (
            <ChangePill
              label={WINDOW_HEADER.day}
              value={page.change1d}
              hint={METRICS.changeDay}
            />
          )}
          {month ? (
            <ChangePill
              label={WINDOW_HEADER.month}
              value={month.value}
              hint={METRICS.changeMonth}
            />
          ) : null}
          {quarter ? (
            <ChangePill
              label={WINDOW_HEADER.quarter}
              value={quarter.value}
              hint={METRICS.changeQuarter}
            />
          ) : null}
        </>
      }
      aside={
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <StatCard
            label={METRICS.payRange.title}
            value={
              salary.available
                ? formatPayRange(salary.p25, salary.p75)
                : NO_FIGURE
            }
            detail={salary.available ? MARKET_COPY.seniorRolesUs : undefined}
            hint={METRICS.payRange}
          />
          <StatCard
            label={MARKET_COPY.remote}
            value={remote === null ? NO_FIGURE : formatShare(remote)}
            detail={
              remote === null ? undefined : (
                <ShareBar value={remote} className="mt-1.5" />
              )
            }
            hint={METRICS.remoteShare}
          />
          <StatCard
            label={METRICS.typicalAge.title}
            value={
              page.medianDaysOpen === null
                ? NO_FIGURE
                : daysOld(formatDays(page.medianDaysOpen))
            }
            hint={METRICS.typicalAge}
          />
          <StatCard
            label={METRICS.companiesHiring.title}
            value={
              page.companiesHiring === null
                ? NO_FIGURE
                : formatCount(page.companiesHiring)
            }
            hint={METRICS.companiesHiring}
          />
        </div>
      }
    />
  );
}
