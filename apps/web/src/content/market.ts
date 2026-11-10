/**
 * The words on the Market and Professions pages that are not a figure's hover
 * card: card titles, what a card says when it has nothing to list, and the
 * small labels around the numbers.
 */
export const MARKET_COPY = {
  status: "Market status",
  hiringIndex: "Tech Hiring Index",
  openTechRoles: "tech roles open right now",
  lastThirtyDays: "Open roles, last 30 days",
  newlyPosted: "newly posted roles",
  posted: "Posted",
  today: "Today",
  professionsGaining: "Professions gaining",
  companiesRamping: "Companies ramping",
  professions: "Professions",
  whereTheJobsAre: "Where the jobs are",
  gaining: "More roles than last week",
  cooling: "Fewer roles than last week",
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

/** "42 days old": the age of the typical open role. */
export function daysOld(days: string): string {
  return `${days} old`;
}
