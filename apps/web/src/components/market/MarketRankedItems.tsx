import { Logo } from "@/components/data/Logo";
import type { RankedItem } from "@/components/data/RankedList";
import { Sparkline } from "@/components/data/Sparkline";
import type { CompanyMover } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { professionHref, type ProfessionRow } from "@/lib/professions";

/** The small 30-day line a ranked row shows where the card is wide enough. */
function trendOf(values: readonly number[], end: string | null) {
  return (
    <Sparkline
      values={values}
      end={end}
      width={64}
      height={24}
      className="hidden xl:block"
    />
  );
}

/** Professions as ranked rows, numbered from `start + 1`, for a market card or a phone's mini list. */
export function professionItems(
  rows: readonly ProfessionRow[],
  {
    value,
    change,
    start = 0,
    trend = false,
    end = null,
  }: {
    readonly value: (row: ProfessionRow) => string;
    readonly change?: ((row: ProfessionRow) => number | undefined) | undefined;
    readonly start?: number;
    readonly trend?: boolean;
    /** The day the trend's last point falls on, so hovering it reads a date. */
    readonly end?: string | null;
  },
): RankedItem[] {
  return rows.map((row, index) => {
    const delta = change?.(row);
    return {
      rank: start + index + 1,
      logo: <Logo name={row.name} shape="square" size="sm" />,
      name: row.name,
      code: row.code,
      value: value(row),
      ...(trend ? { trend: trendOf(row.spark, end) } : {}),
      to: professionHref(row.code),
      ...(delta === undefined ? {} : { change: delta }),
    };
  });
}

/** The companies ramping fastest as ranked rows, numbered from `start + 1`. */
export function rampingCompanyItems(
  rows: readonly CompanyMover[],
  {
    start = 0,
    trend = false,
    end = null,
  }: {
    readonly start?: number;
    readonly trend?: boolean;
    readonly end?: string | null;
  } = {},
): RankedItem[] {
  return rows.map((row, index) => ({
    rank: start + index + 1,
    logo: <Logo name={row.name} domain={row.domain} size="sm" />,
    name: row.name,
    value: formatCount(row.open),
    ...(trend ? { trend: trendOf(row.spark, end) } : {}),
    to: `/companies/${row.slug}`,
    ...(row.change ? { change: row.change.value } : {}),
  }));
}
