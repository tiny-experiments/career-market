/**
 * Formatters for every figure on the site (UI-RULEBOOK.md §9). Never format
 * inline: a number reads the same in a tile, a table cell and a hover card.
 */

const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const share = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 99923 → "99,923". Whole figures, every digit: this is a market, not a dashboard. */
export function formatCount(value: number): string {
  return count.format(value);
}

/** 0.037 → "3.7%". The sign belongs to `Delta`, not to the number. */
export function formatPercent(ratio: number): string {
  return `${percent.format(Math.abs(ratio) * 100)}%`;
}

/** 0.27 → "27%", for shares of a whole (remote share, a level's slice). */
export function formatShare(ratio: number): string {
  return `${share.format(ratio * 100)}%`;
}

/** 144000 → "$144K"; 1250000 → "$1.25M". Pay is always USD here. */
export function formatPay(amount: number): string {
  if (Math.round(amount / 1000) >= 1000) {
    const millions = amount / 1_000_000;
    return `$${millions.toFixed(millions >= 10 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  }
  return `$${Math.round(amount / 1000)}K`;
}

/** (144000, 157000) → "$144K–$157K". One figure when both ends meet. */
export function formatPayRange(low: number, high: number): string {
  const a = formatPay(low);
  const b = formatPay(high);
  return a === b ? a : `${a}–${b}`;
}

/** 38 → "38 days"; 1 → "1 day". */
export function formatDays(days: number): string {
  const whole = Math.round(days);
  return `${count.format(whole)} ${whole === 1 ? "day" : "days"}`;
}

/** "Software" + "Platform & Infra" → "S", "PI": the monogram behind a missing logo. */
export function monogram(name: string): string {
  const words = name
    .split(/[\s&/,-]+/)
    .filter((word) => /^[A-Za-z0-9]/.test(word));
  const first = words[0]?.[0] ?? name[0] ?? "?";
  const second = words.length > 1 ? (words[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

export type Direction = "up" | "down" | "flat";

/** The direction a change reads as; changes under half a tenth of a percent are flat. */
export function direction(ratio: number): Direction {
  if (ratio > 0.0005) return "up";
  if (ratio < -0.0005) return "down";
  return "flat";
}
