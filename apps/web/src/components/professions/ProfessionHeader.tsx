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
import { HINTS } from "@/lib/marketCopy";
import { ChangePill } from "./ChangePill";

const NO_FIGURE = "—";

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
        label: "open roles",
        ...(week
          ? {
              change: (
                <Delta value={week.value} suffix="this week" variant="pill" />
              ),
            }
          : {}),
      }}
      facts={
        <>
          {page.change1d === null ? null : (
            <ChangePill
              label="1D"
              value={page.change1d}
              hint={HINTS.changeDay}
            />
          )}
          {month ? (
            <ChangePill
              label="30D"
              value={month.value}
              hint={HINTS.changeMonth}
            />
          ) : null}
          {quarter ? (
            <ChangePill
              label="3M"
              value={quarter.value}
              hint={HINTS.changeQuarter}
            />
          ) : null}
        </>
      }
      aside={
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <StatCard
            label={HINTS.payRange.title}
            value={
              salary.available
                ? formatPayRange(salary.p25, salary.p75)
                : NO_FIGURE
            }
            detail={salary.available ? "Senior roles, US" : undefined}
            hint={HINTS.payRange}
          />
          <StatCard
            label="Remote"
            value={remote === null ? NO_FIGURE : formatShare(remote)}
            detail={
              remote === null ? undefined : (
                <ShareBar value={remote} className="mt-1.5" />
              )
            }
            hint={HINTS.remoteShare}
          />
          <StatCard
            label={HINTS.typicalTimeOpen.title}
            value={
              page.medianDaysOpen === null
                ? NO_FIGURE
                : formatDays(page.medianDaysOpen)
            }
            hint={HINTS.typicalTimeOpen}
          />
          <StatCard
            label={HINTS.companiesHiring.title}
            value={
              page.companiesHiring === null
                ? NO_FIGURE
                : formatCount(page.companiesHiring)
            }
            hint={HINTS.companiesHiring}
          />
        </div>
      }
    />
  );
}
