import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { clearResources } from "@/lib/api";
import { MarketPage } from "@/pages/MarketPage";
import { ProfessionPage } from "@/pages/ProfessionPage";
import { ProfessionsPage } from "@/pages/ProfessionsPage";
import { stubFetch } from "../support/fetchStub";
import {
  MARKET_FIXTURE,
  PROFESSIONS_FIXTURE,
  PROFESSION_FIXTURE,
} from "../support/marketFixtures";
import { renderWithRouter } from "../support/renderWithRouter";

beforeEach(() => clearResources());

const names = () =>
  within(screen.getByRole("table", { name: "Professions by open roles" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getByRole("link").textContent);

describe("MarketPage", () => {
  beforeEach(() => {
    stubFetch({
      "/api/market": { body: MARKET_FIXTURE },
      "/api/professions": { body: PROFESSIONS_FIXTURE },
    });
  });

  it("opens with the market cards and the table by open roles", async () => {
    renderWithRouter(<MarketPage />);
    expect(await screen.findByText("Market status")).toBeInTheDocument();
    expect(screen.getByText("Professions gaining")).toBeInTheDocument();
    expect(screen.getByText("Companies ramping")).toBeInTheDocument();
    expect(names()[0]).toContain("Software");
  });

  it("colours the gauge by the direction of the headline change", async () => {
    const { container } = renderWithRouter(<MarketPage />);
    await screen.findByText("Market status");
    expect(container.querySelector("svg .stroke-up")).toBeInTheDocument();
    expect(container.querySelector("svg .stroke-down")).toBeNull();
  });

  it("re-sorts the table for a view", async () => {
    renderWithRouter(<MarketPage />, { path: "/?view=cooling" });
    await screen.findByText("Market status");
    expect(names()[0]).toContain("Data");
  });

  it("shows the new-roles column only on its view", async () => {
    renderWithRouter(<MarketPage />, { path: "/?view=new" });
    expect(await screen.findByText("New this week")).toBeInTheDocument();
  });

  it("makes the whole row a link to the profession", async () => {
    renderWithRouter(<MarketPage />);
    const link = await screen.findByRole("link", { name: /^Software/ });
    expect(link).toHaveAttribute("href", "/professions/swe");
  });

  it("never states a company total or a stamp", async () => {
    const { container } = renderWithRouter(<MarketPage />);
    await screen.findByText("Market status");
    expect(container.textContent).not.toMatch(/18,580|Updated|as of/i);
  });
});

describe("ProfessionsPage", () => {
  it("scopes the table to a region and drops worldwide-only columns", async () => {
    const fetchMock = stubFetch({
      "/api/professions?region=europe": { body: PROFESSIONS_FIXTURE },
    });
    renderWithRouter(<ProfessionsPage />, {
      path: "/professions?region=europe",
    });
    expect(await screen.findByText("Best paid")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/professions?region=europe",
      expect.anything(),
    );
    expect(
      screen.queryByRole("columnheader", { name: /Companies/ }),
    ).not.toBeInTheDocument();
  });
});

describe("ProfessionPage", () => {
  beforeEach(() => {
    stubFetch({ "/api/professions/swe": { body: PROFESSION_FIXTURE } });
  });

  const open = () =>
    renderWithRouter(<ProfessionPage />, {
      path: "/professions/swe",
      routePath: "/professions/:code",
    });

  it("draws the header, facts and all the sections", async () => {
    open();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Software Engineering",
      }),
    ).toBeInTheDocument();
    for (const title of [
      "Pay range",
      "Specialties",
      "Seniority",
      "Where",
      "Companies hiring",
      "Skills in demand",
      "Latest jobs",
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });

  it("sends a job row to our own job page, never the employer", async () => {
    const { container } = open();
    const job = await screen.findByRole("link", {
      name: /Staff Engineer/,
    });
    expect(job).toHaveAttribute("href", "/jobs/kr_1");
    await waitFor(() =>
      expect(container.querySelectorAll('a[href^="http"]').length).toBe(0),
    );
  });

  it("links to every job in the profession", async () => {
    open();
    const all = await screen.findByRole("link", {
      name: /See all 1,000 jobs/,
    });
    expect(all).toHaveAttribute("href", "/jobs?family=software");
  });

  it("switches the chart range", async () => {
    open();
    const user = userEvent.setup();
    const tab = await screen.findByRole("tab", { name: "All" });
    await user.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
  });
});
