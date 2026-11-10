/** The company and skill pages' own headings, column names and captions. */
export const DIRECTORY_COPY = {
  searchCompanies: "Search companies",
  searchSkills: "Search skills",
  rampingFastest: "Ramping fastest",
  coolingFastest: "Cooling fastest",
  hiringSignals: "Hiring signals",
  mostlyRamping: "More companies are ramping than cooling.",
  mostlyCooling: "More companies are cooling than ramping.",
  balanced: "About as many companies are ramping as cooling.",
  fastestGrowing: "Fastest growing",
  bestPaid: "Best paid",
  mostPaired: "Most paired",
  hiringFlow: "Openings and closings",
  openRolesChart: "Open roles",
  rolesByProfession: "Roles by profession",
  seniority: "Seniority",
  where: "Where",
  workMode: "Work mode",
  askedFor: "Skills they ask for",
  openRolesTable: "Open roles",
  whereUsed: "Professions",
  pairedWith: "Paired with",
  comparedWith: "Compared with",
  whoIsHiring: "Companies hiring",
  latestJobs: "Latest jobs",
  noMovers: "Nothing has moved enough this week.",
  openRolesUnit: "open roles",
  columns: {
    rank: "#",
    company: "Company",
    skill: "Skill",
    openRoles: "Open roles",
    signal: "Signal",
    remote: "Remote",
    role: "Role",
    location: "Location",
    workMode: "Work mode",
    seniority: "Seniority",
    pay: "Pay",
    posted: "Posted",
  },
  thisSkill: "This skill",
  companiesCaption: "Companies with open tech roles",
  skillsCaption: "Skills named in open tech roles",
  skillCompaniesCaption: "Companies hiring for this skill",
} as const;

/** "753 hiring more": the ramping side of the hiring-signals bar. */
export function hiringMore(count: string): string {
  return `${count} hiring more`;
}

/** "468 hiring less": the cooling and freezing side. */
export function hiringLess(count: string): string {
  return `${count} hiring less`;
}

/** "#12 by open roles". */
export function rankByOpenRoles(rank: string): string {
  return `#${rank} by open roles`;
}

/** "Share of Software": a skill's slice of its largest profession. */
export function shareOf(profession: string): string {
  return `Share of ${profession}`;
}

export function openRolesAt(company: string): string {
  return `Open roles at ${company}`;
}

export function openRolesAtOverTime(company: string): string {
  return `Open roles at ${company} over time`;
}

export function openRolesNamingOverTime(skill: string): string {
  return `Open roles naming ${skill} over time`;
}

export function latestJobsNaming(skill: string): string {
  return `Latest jobs naming ${skill}`;
}

/** "last 6 days": the window a company's openings and closings cover. */
export function lastDays(days: number): string {
  return days === 1 ? "last day" : `last ${days} days`;
}
