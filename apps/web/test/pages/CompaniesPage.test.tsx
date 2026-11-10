import {
  configure,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { clearResources } from "@/lib/api";
import { CompaniesPage } from "@/pages/CompaniesPage";
import { companyRow, signalsOverview } from "../support/directoryFixtures";
import { stubFetch } from "../support/fetchStub";
import { renderWithRouter } from "../support/renderWithRouter";

const page = (items: unknown[], total: number) => ({
  body: { items, page: 1, pageSize: 50, total },
});

// A busy machine must not read as a broken page.
configure({ asyncUtilTimeout: 4000 });

describe("CompaniesPage", () => {
  beforeEach(() => clearResources());

  it("lists companies with a whole-row link and never states how many there are", async () => {
    stubFetch({
      "/api/companies?page=1&pageSize=50": page([companyRow()], 18580),
      "/api/company-signals": { body: signalsOverview },
    });
    renderWithRouter(<CompaniesPage />, { path: "/companies" });

    const link = await screen.findByRole("link", { name: "Stripe" });
    expect(link).toHaveAttribute("href", "/companies/stripe");
    expect(document.body.textContent).not.toContain("18,580");
    expect(document.body.textContent).not.toContain("18580");
    expect(await screen.findByText("Ramping fastest")).toBeInTheDocument();
    expect(screen.getByText("17,136")).toBeInTheDocument();
  });

  it("shows a dash when a company has no full 30 days to compare", async () => {
    stubFetch({
      "/api/companies?page=1&pageSize=50": page(
        [companyRow({ change30d: null })],
        1,
      ),
      "/api/company-signals": { body: signalsOverview },
    });
    renderWithRouter(<CompaniesPage />, { path: "/companies" });

    const row = (await screen.findByRole("link", { name: "Stripe" })).closest(
      "tr",
    ) as HTMLElement;
    expect(within(row).getByText("—")).toBeInTheDocument();
    // A column of dashes has nothing to order by.
    expect(
      screen.queryByRole("button", { name: /^30D/ }),
    ).not.toBeInTheDocument();
  });

  it("says how hiring leans in words, with no gauge", async () => {
    stubFetch({
      "/api/companies?page=1&pageSize=50": page([companyRow()], 1),
      "/api/company-signals": { body: signalsOverview },
    });
    renderWithRouter(<CompaniesPage />, { path: "/companies" });
    expect(
      await screen.findByText(
        "About as many companies are ramping as cooling.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("587 hiring more")).toBeInTheDocument();
    expect(screen.getByText("528 hiring less")).toBeInTheDocument();
  });

  it("filters by signal through the address, from the first page", async () => {
    stubFetch({
      "/api/companies?page=2&pageSize=50": page([companyRow()], 200),
      "/api/companies?page=1&pageSize=50&signal=cooling": page(
        [companyRow({ slug: "acme", name: "Acme" })],
        1,
      ),
      "/api/company-signals": { body: signalsOverview },
    });
    renderWithRouter(<CompaniesPage />, { path: "/companies?page=2" });
    await userEvent.click(
      await screen.findByRole("radio", { name: "Hiring less" }),
    );
    await screen.findByRole("link", { name: "Acme" });
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/companies?signal=cooling",
    );
    expect(
      screen.getByText(/Cooling: companies with fewer open roles/),
    ).toBeInTheDocument();
  });

  it("sorts through the address and resets to the first page", async () => {
    stubFetch({
      "/api/companies?page=2&pageSize=50": page([companyRow()], 200),
      "/api/companies?dir=asc&page=1&pageSize=50&sort=name": page(
        [companyRow({ slug: "acme", name: "Acme" })],
        200,
      ),
      "/api/company-signals": { body: signalsOverview },
    });
    renderWithRouter(<CompaniesPage />, { path: "/companies?page=2" });
    await userEvent.click(
      await screen.findByRole("button", { name: /Company/ }),
    );
    await screen.findByRole("link", { name: "Acme" });
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/companies?sort=name&dir=asc",
    );
  });

  it(
    "searches by name and says what to do when nothing matches",
    { timeout: 15000 },
    async () => {
      stubFetch({
        "/api/companies?page=1&pageSize=50": page([companyRow()], 1),
        "/api/companies?page=1&pageSize=50&q=zzz": page([], 0),
        "/api/company-signals": { body: signalsOverview },
      });
      renderWithRouter(<CompaniesPage />, { path: "/companies" });
      await screen.findByRole("link", { name: "Stripe" });
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search companies" }),
        { target: { value: "zzz" } },
      );
      // The field waits a beat before it touches the address.
      await waitFor(() =>
        expect(screen.getByText("No companies match")).toBeInTheDocument(),
      );
      expect(screen.getByRole("searchbox")).toHaveValue("zzz");
    },
  );

  it("offers a retry when the list cannot be loaded", async () => {
    stubFetch({
      "/api/companies?page=1&pageSize=50": {
        status: 500,
        body: { message: "Internal", code: "INTERNAL" },
      },
      "/api/company-signals": { body: signalsOverview },
    });
    renderWithRouter(<CompaniesPage />, { path: "/companies" });
    expect(
      await screen.findByText("Companies could not be loaded."),
    ).toBeInTheDocument();
  });
});
