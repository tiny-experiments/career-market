import { createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/RootLayout.tsx";
import {
  COMPANIES_TABS,
  JOBS_TABS,
  MARKET_TABS,
  PROFESSIONS_TABS,
  SKILLS_TABS,
  type RouteHandle,
} from "./lib/nav.ts";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { PlaceholderPage } from "./pages/PlaceholderPage.tsx";

const handle = (value: RouteHandle): RouteHandle => value;

/**
 * The page map. Each section declares its sub-bar here so the chrome follows
 * the route; the data pages replace the placeholders one by one.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        handle: handle({ title: "Market", subBar: MARKET_TABS }),
        element: (
          <PlaceholderPage
            title="Market"
            description="Open tech roles across every profession, company and skill, and how they move."
          />
        ),
      },
      {
        path: "professions",
        handle: handle({ title: "Professions", subBar: PROFESSIONS_TABS }),
        element: (
          <PlaceholderPage
            title="Professions"
            description="Every profession with its open roles, pay range and how demand is moving."
          />
        ),
      },
      {
        path: "companies",
        handle: handle({ title: "Companies", subBar: COMPANIES_TABS }),
        element: (
          <PlaceholderPage
            title="Companies"
            description="Every company with open tech roles, from ramping to freezing."
          />
        ),
      },
      {
        path: "skills",
        handle: handle({ title: "Skills", subBar: SKILLS_TABS }),
        element: (
          <PlaceholderPage
            title="Skills"
            description="The skills roles ask for, what they pay and which pair together."
          />
        ),
      },
      {
        path: "jobs",
        handle: handle({ title: "Jobs", subBar: JOBS_TABS }),
        element: (
          <PlaceholderPage
            title="Jobs"
            description="Open roles, filtered by profession, company, place, work mode and pay."
          />
        ),
      },
      {
        path: "about",
        handle: handle({ title: "About" }),
        element: (
          <PlaceholderPage
            title="About"
            description="What Career Market is and who it is for."
          />
        ),
      },
      ...(import.meta.env.DEV
        ? [
            {
              path: "design",
              handle: handle({ title: "Design system" }),
              lazy: async () => ({
                Component: (await import("./pages/DesignSystemPage.tsx"))
                  .DesignSystemPage,
              }),
            },
          ]
        : []),
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
