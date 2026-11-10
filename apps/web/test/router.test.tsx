import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { clearResources } from "@/lib/api";
import { PAGES } from "@/content";
import { routes } from "@/router";
import {
  companyPayload,
  companyRow,
  jobItem,
  signalsOverview,
  skillPayload,
} from "./support/directoryFixtures";
import { stubFetch, type Routes } from "./support/fetchStub";
import {
  MARKET_FIXTURE,
  PROFESSIONS_FIXTURE,
  PROFESSION_FIXTURE,
} from "./support/marketFixtures";
import { jobListItem, jobPage } from "./support/jobFixtures";

const page = (items: unknown[] = [{}]) => ({
  body: { items, page: 1, pageSize: 50, total: items.length },
});

const API: Routes = {
  "/api/market": { body: MARKET_FIXTURE },
  "/api/professions": { body: PROFESSIONS_FIXTURE },
  "/api/professions/swe": { body: PROFESSION_FIXTURE },
  "/api/companies?page=1&pageSize=50": page([companyRow()]),
  "/api/companies?page=1&pageSize=50&signal=ramping": page([companyRow()]),
  "/api/company-signals": { body: signalsOverview },
  "/api/companies/stripe": { body: companyPayload },
  "/api/companies/stripe/jobs?page=1&pageSize=25": page([jobItem]),
  "/api/skills": { body: { skills: [] } },
  "/api/skills/python": { body: skillPayload },
  "/api/jobs?page=1&pageSize=50": page([jobListItem()]),
  "/api/jobs?page=1&pageSize=50&workMode=remote": page([jobListItem()]),
  "/api/jobs/pulse": {
    body: {
      open: 100,
      newToday: 3,
      withPay: 40,
      change1w: 0.01,
      openSpark: [99, 100],
      newSpark: [2, 3],
      workModes: { remote: 1, hybrid: 1, onsite: 1 },
      professions: [],
    },
  },
  "/api/jobs/facets": { body: { facets: [] } },
  "/api/jobs/kr_open12": { body: jobPage() },
  "/api/jobs/kr_gone12": {
    status: 410,
    body: {
      status: "closed",
      id: "kr_gone12",
      closedAt: "2026-11-07",
      openedAt: null,
      openedSource: null,
      family: null,
      familyName: null,
    },
  },
  "/api/search?limit=10&q=rust&roles=1": {
    body: {
      query: "rust",
      groups: [],
      roles: [],
      rolesTotal: 0,
      rolesUnavailable: false,
    },
  },
};

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ThemeProvider attribute="class">
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

const heading = (name: string) =>
  screen.findByRole("heading", { level: 1, name }, { timeout: 4000 });

beforeEach(() => clearResources());

describe("the router", () => {
  it.each([
    ["/", "Market", "/api/market"],
    ["/professions", "Professions", "/api/professions"],
    ["/professions/swe", "Software Engineering", "/api/professions/swe"],
    ["/companies", "Companies", "/api/companies?page=1&pageSize=50"],
    [
      "/companies?signal=ramping",
      "Companies",
      "/api/companies?page=1&pageSize=50&signal=ramping",
    ],
    ["/companies/stripe", "Stripe", "/api/companies/stripe"],
    ["/skills", "Skills", "/api/skills"],
    ["/skills/python", "Python", "/api/skills/python"],
    ["/jobs", "Jobs", "/api/jobs?page=1&pageSize=50"],
    [
      "/jobs?mode=remote",
      "Jobs",
      "/api/jobs?page=1&pageSize=50&workMode=remote",
    ],
    ["/jobs/kr_open12", "Staff Engineer", "/api/jobs/kr_open12"],
    ["/jobs/kr_gone12", "This role has closed", "/api/jobs/kr_gone12"],
    [
      "/search?q=rust",
      "Results for “rust”",
      "/api/search?limit=10&q=rust&roles=1",
    ],
  ])(
    "opens %s wired to its endpoint, with one request",
    async (path, title, api) => {
      const mock = stubFetch(API);
      open(path);
      await heading(title);
      await waitFor(() =>
        expect(screen.queryByRole("status", { name: "Loading" })).toBeNull(),
      );
      const asked = mock.mock.calls.map(([url]) => String(url));
      expect(asked.filter((url) => url === api)).toHaveLength(1);
    },
  );

  it("opens About without touching the API", async () => {
    const mock = stubFetch();
    open("/about");
    await heading("About");
    expect(mock).not.toHaveBeenCalled();
  });

  it("sets the tab title and meta description from the page's copy, and restores the site's", async () => {
    stubFetch();
    const tag = document.createElement("meta");
    tag.name = "description";
    tag.content = "The site description";
    document.head.append(tag);
    try {
      const router = open("/about");
      await heading("About");
      await waitFor(() => expect(tag.content).toBe(PAGES.about.meta));
      expect(document.title).toBe("About · Career Market");

      await router.navigate("/nope/nothing");
      await waitFor(() => expect(tag.content).toBe("The site description"));
      expect(document.title).toBe("Career Market");
    } finally {
      tag.remove();
    }
  });

  it("does not ask for an empty search", async () => {
    const mock = stubFetch();
    open("/search");
    await heading("Search");
    expect(mock).not.toHaveBeenCalled();
  });

  it("shows the not-found state for an unknown address", async () => {
    stubFetch();
    open("/nope/nothing");
    expect(
      await screen.findByText("We couldn't find that page"),
    ).toBeInTheDocument();
  });

  it("shows the not-found state for a profession that does not exist", async () => {
    stubFetch();
    open("/professions/zzz");
    expect(
      await screen.findByText("We couldn't find that page", undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument();
  });

  it("asks once for something that failed, with no flicker", async () => {
    const mock = stubFetch();
    open("/professions/zzz");
    await screen.findByText("We couldn't find that page", undefined, {
      timeout: 4000,
    });
    expect(
      mock.mock.calls.filter(([url]) => url === "/api/professions/zzz"),
    ).toHaveLength(1);
  });

  it("offers a retry when the API fails, and recovers", async () => {
    const failing: Routes = {
      "/api/skills": { status: 500, body: { code: "INTERNAL" } },
    };
    stubFetch(failing);
    open("/skills");
    const retry = await screen.findByRole(
      "button",
      { name: "Try again" },
      { timeout: 4000 },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Skills could not be loaded",
    );
    expect(document.body).not.toHaveTextContent("INTERNAL");
    failing["/api/skills"] = { body: { skills: [] } };
    await userEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it.each([
    ["/screener", "/jobs", ""],
    [
      "/screener?family=swe&workMode=remote",
      "/jobs",
      "?family=swe&mode=remote",
    ],
    [
      "/screener?mode=companies&growth=ramping",
      "/companies",
      "?signal=ramping",
    ],
    ["/screener?mode=professions", "/professions", ""],
    ["/screener?mode=skills", "/skills", ""],
    ["/job/kr_open12/staff-engineer", "/jobs/kr_open12", ""],
    ["/methodology", "/about", ""],
    ["/data", "/about", ""],
    ["/report", "/", ""],
  ])("redirects %s", async (from, pathname, search) => {
    stubFetch(API);
    const router = open(from);
    await waitFor(() =>
      expect(router.state.location).toMatchObject({ pathname, search }),
    );
  });

  it("has no sub-navigation: an old view address opens its filter on the table", async () => {
    stubFetch(API);
    open("/companies?signal=ramping");
    await heading("Companies");
    expect(screen.queryByRole("navigation", { name: "Views" })).toBeNull();
    expect(
      await screen.findByRole("radio", { name: "Hiring more" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});

describe("navigating", () => {
  it("returns to a visited page instantly, without asking again", async () => {
    const mock = stubFetch(API);
    const router = open("/skills/python");
    await heading("Python");
    await router.navigate("/professions/swe");
    await heading("Software Engineering");
    const before = mock.mock.calls.length;
    let flashed = false;
    const observer = new MutationObserver(() => {
      flashed ||= screen.queryByRole("status", { name: "Loading" }) !== null;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    await router.navigate(-1);
    await heading("Python");
    observer.disconnect();
    expect(flashed).toBe(false);
    expect(mock.mock.calls.length).toBe(before);
  });
});
