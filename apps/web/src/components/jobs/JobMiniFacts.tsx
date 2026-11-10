import { MiniRow, MiniStat } from "@/components/data";
import type { JobPagePayload } from "@/lib/api";
import {
  changeSuffix,
  JOB_PAGE,
  METRICS,
  openRoles,
  PAY_POSITION,
} from "@/content";
import { yearlyPay } from "@/lib/jobRows";

/**
 * The rail's three panels shrunk for a phone and moved up under the verdict:
 * the pay, the company and the profession, each a tile that opens its page.
 * The full panels still follow the posting.
 */
export function JobMiniFacts({ page }: { readonly page: JobPagePayload }) {
  const { job, context } = page;
  const pay = yearlyPay(job.salary);
  const band = context.salaryBand;
  const company = context.companyTrend;
  const profession = context.professionTrend;

  return (
    <MiniRow label={JOB_PAGE.keyFacts}>
      <MiniStat
        label={JOB_PAGE.pay}
        value={pay ?? JOB_PAGE.notListed}
        {...(band.available
          ? {
              caption: PAY_POSITION[band.verdict],
              hint: METRICS.payVersusRange,
            }
          : {})}
      />
      <MiniStat
        label={JOB_PAGE.company}
        value={job.company.name}
        {...(company.available ? { caption: openRoles(company.open) } : {})}
        {...(job.company.slug ? { to: `/companies/${job.company.slug}` } : {})}
      />
      {profession.available ? (
        <MiniStat
          label={JOB_PAGE.profession}
          value={profession.name}
          to={`/professions/${profession.code.toLowerCase()}`}
          {...(profession.change === null
            ? { caption: openRoles(profession.open) }
            : {
                change: profession.change.value,
                suffix: changeSuffix("week"),
              })}
        />
      ) : null}
    </MiniRow>
  );
}
