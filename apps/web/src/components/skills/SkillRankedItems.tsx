import { Logo, Sparkline, type RankedItem } from "@/components/data";
import type { SkillIndexRow } from "@/lib/api";
import { formatCount, formatPay, formatShare } from "@/lib/format";

export function skillLogo(row: {
  readonly label: string;
  readonly domain: string | null;
}) {
  return <Logo name={row.label} domain={row.domain} shape="square" size="sm" />;
}

function rankedBase(row: SkillIndexRow, index: number) {
  return {
    rank: index + 1,
    logo: skillLogo(row),
    name: row.label,
    to: `/skills/${row.slug}`,
  };
}

export function growingItems(rows: readonly SkillIndexRow[]): RankedItem[] {
  return rows.map((row, index) => ({
    ...rankedBase(row, index),
    value: formatCount(row.open),
    ...(row.change ? { change: row.change.value } : {}),
    trend: (
      <Sparkline
        values={row.spark}
        width={56}
        height={22}
        className="hidden sm:block"
      />
    ),
  }));
}

export function paidItems(rows: readonly SkillIndexRow[]): RankedItem[] {
  return rows.map((row, index) => ({
    ...rankedBase(row, index),
    value: row.pay ? formatPay(row.pay.median) : "",
  }));
}

export function pairedItems(rows: readonly SkillIndexRow[]): RankedItem[] {
  return rows.map((row, index) => ({
    ...rankedBase(row, index),
    logo: (
      <span className="flex shrink-0 -space-x-1.5">
        {skillLogo(row)}
        {row.topPair ? skillLogo(row.topPair) : null}
      </span>
    ),
    name: row.topPair ? `${row.label} + ${row.topPair.label}` : row.label,
    value: row.topPair ? formatShare(row.topPair.share) : "",
  }));
}
