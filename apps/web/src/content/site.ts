/**
 * The site's own words: its name, the line in the footer, the About page,
 * and each page's title and descriptions. Nothing here says where roles come
 * from, how they are gathered, or how many companies there are.
 */

export const SITE_NAME = "Career Market";

/** The only sentence on the site about where roles come from. */
export const FOOTER_LINE =
  "Open roles from 48,000+ company career pages, updated through the day.";

/** Two sentences. No counts, no method. */
export const ABOUT = {
  title: "About",
  sentences: [
    "Career Market charts open tech roles the way a market page charts stocks: by profession, company and skill, with pay and how demand is moving.",
    "Every role here leads to the employer's own careers page, where applications happen.",
  ],
} as const;

/** The browser tab: "Software Engineering · Career Market", or the site alone. */
export function documentTitle(page?: string | null): string {
  const part = page?.trim();
  return part ? `${part} · ${SITE_NAME}` : SITE_NAME;
}

export interface PageCopy {
  /** The page's name, as the header and the tab show it. */
  readonly title: string;
  /** One line under the header. */
  readonly description: string;
  /** The `<meta name="description">` for this page. */
  readonly meta: string;
}

/** The list pages and the About page. Detail pages are built with the helpers below. */
export const PAGES = {
  market: {
    title: "Market",
    description:
      "Open tech roles across every profession, company and skill, and how they move.",
    meta: "Open tech roles, pay and demand across professions, companies and skills, charted like a market.",
  },
  professions: {
    title: "Professions",
    description:
      "Every profession with its open roles, pay range and how demand is moving.",
    meta: "Tech professions ranked by open roles, with pay ranges, hiring companies and demand over time.",
  },
  companies: {
    title: "Companies",
    description:
      "Every company with open tech roles, from ramping to freezing.",
    meta: "Companies with open tech roles, their hiring signal and how their openings are moving.",
  },
  skills: {
    title: "Skills",
    description:
      "The skills roles ask for, what they pay and which pair together.",
    meta: "Tech skills ranked by demand, with pay, the professions that ask for them and the skills they pair with.",
  },
  jobs: {
    title: "Jobs",
    description:
      "Open roles, filtered by profession, company, place, work mode and pay.",
    meta: "Open tech jobs, filtered by profession, company, location, work mode, seniority and pay.",
  },
  about: {
    title: ABOUT.title,
    description: "What Career Market is and who it is for.",
    meta: "What Career Market is: open tech roles, pay and demand, charted like a market.",
  },
  notFound: {
    title: "Page not found",
    description: "The link may be old, or the page may have moved.",
    meta: "This page could not be found. The link may be old, or the page may have moved.",
  },
} as const satisfies Record<string, PageCopy>;

export type PageKey = keyof typeof PAGES;

/** A profession's page: "Software Engineering". */
export function professionPage(name: string): PageCopy {
  return {
    title: name,
    description: `Open roles, pay range and demand for ${name}.`,
    meta: `${name} jobs: open roles, pay range, hiring companies and how demand is moving.`,
  };
}

/** A company's page: "Stripe". */
export function companyPage(name: string): PageCopy {
  return {
    title: name,
    description: `Open tech roles at ${name}, by team, level and place.`,
    meta: `Tech jobs at ${name}: open roles, hiring signal, teams and locations.`,
  };
}

/** A skill's page: "Python". */
export function skillPage(name: string): PageCopy {
  return {
    title: name,
    description: `Open roles that ask for ${name}, who is hiring and what they pay.`,
    meta: `${name} jobs: open roles, pay, the professions that ask for it and the skills it pairs with.`,
  };
}

/** A job's page: "Staff Engineer at Stripe". */
export function jobPage(title: string, company: string): PageCopy {
  return {
    title: `${title} at ${company}`,
    description: `An open role at ${company}.`,
    meta: `${title} at ${company}: the posting, its pay against the market, and similar open roles.`,
  };
}
