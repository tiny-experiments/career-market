/**
 * The words on the Market and Professions pages that are not a figure's hover
 * card: card titles, what a card says when it has nothing to list, and the
 * small labels around the numbers.
 */
export const MARKET_COPY = {
  status: "Market status",
  hiringIndex: "Tech Hiring Index",
  professionsGaining: "Professions gaining",
  companiesRamping: "Companies ramping",
  professions: "Professions",
  whereTheJobsAre: "Where the jobs are",
  gaining: "Gaining",
  cooling: "Cooling",
  bestPaid: "Best paid",
  noneGaining: "No profession grew this week.",
  noneCooling: "No profession shrank this week.",
  noPay: "Pay ranges will show here.",
  noneRamping: "No companies are ramping quickly right now.",
  opened: "Opened",
  closed: "Closed",
  worldwide: "Worldwide",
  region: "Region",
  remote: "Remote",
  seniorRolesUs: "Senior roles, US",
  openRolesUnit: "open roles",
} as const;

/** "7 of 18 growing". */
export function professionsGrowing(up: number, total: number): string {
  return `${up} of ${total} growing`;
}
