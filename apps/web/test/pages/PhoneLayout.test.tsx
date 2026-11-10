import { configure, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearResources } from "@/lib/api";
import { CompaniesPage } from "@/pages/CompaniesPage";
import { MarketPage } from "@/pages/MarketPage";
import { ProfessionsPage } from "@/pages/ProfessionsPage";
import { companyRow, signalsOverview } from "../support/directoryFixtures";
import { stubFetch } from "../support/fetchStub";
import { MARKET_FIXTURE, PROFESSIONS_FIXTURE } from "../support/marketFixtures";
import { onPhone } from "../support/phone";
import { renderWithRouter } from "../support/renderWithRouter";

configure({ asyncUtilTimeout: 4000 });

beforeEach(() => {
  clearResources();
  onPhone();
});

describe("on a phone", () => {
  it("Market shows mini tiles and short lists instead of the cards, then the table", async () => {
    stubFetch({
      "/api/market": { body: MARKET_FIXTURE },
      "/api/professions": { body: PROFESSIONS_FIXTURE },
    });
    renderWithRouter(<MarketPage />);

    const glance = await screen.findByRole("group", {
      name: "The market at a glance",
    });
    expect(within(glance).getByText("1,500")).toBeInTheDocument();
    expect(within(glance).getByText("Closed today")).toBeInTheDocument();
    expect(
      within(glance).getByRole("button", { name: "About Tech Hiring Index" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Professions gaining" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Companies ramping" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Market status")).toBeNull();
    expect(screen.queryByText("Open roles, last 30 days")).toBeNull();
    expect(
      screen.getByRole("table", { name: "Professions by open roles" }),
    ).toBeInTheDocument();
  });

  it("Professions turns its three cards into short lists", async () => {
    stubFetch({ "/api/professions": { body: PROFESSIONS_FIXTURE } });
    renderWithRouter(<ProfessionsPage />, { path: "/professions" });

    const lists = await screen.findByRole("group", { name: "Professions" });
    expect(
      within(lists).getByRole("region", { name: "More roles than last week" }),
    ).toBeInTheDocument();
    expect(
      within(lists).getByRole("region", { name: "Best paid" }),
    ).toBeInTheDocument();
  });

  it("Companies shows a tile per hiring signal, each opening its filter", async () => {
    stubFetch({
      "/api/companies?page=1&pageSize=50": {
        body: { items: [companyRow()], page: 1, pageSize: 50, total: 1 },
      },
      "/api/company-signals": { body: signalsOverview },
    });
    renderWithRouter(<CompaniesPage />, { path: "/companies" });

    const signals = await screen.findByRole("group", {
      name: "Hiring signals",
    });
    expect(
      within(signals).getByRole("link", { name: /Cooling\s*299/ }),
    ).toHaveAttribute("href", "/companies?signal=cooling");
    expect(
      screen.getByRole("region", { name: "Ramping fastest" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("587 hiring more")).toBeNull();
  });
});
