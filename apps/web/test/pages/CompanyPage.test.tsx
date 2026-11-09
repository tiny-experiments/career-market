import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Navigate } from "react-router";
import { clearResources } from "@/lib/api";
import { CompanyPage } from "@/pages/CompanyPage";
import { companyPayload, jobItem } from "../support/directoryFixtures";
import { stubFetch } from "../support/fetchStub";
import { renderWithRouter } from "../support/renderWithRouter";

const ui = <Navigate to="/companies/stripe" />;
const options = {
  path: "/",
  extraRoutes: [{ path: "/companies/:slug", element: <CompanyPage /> }],
};

function stub(company: unknown = companyPayload) {
  stubFetch({
    "/api/companies/stripe": { body: company },
    "/api/companies/stripe/jobs?page=1&pageSize=25": {
      body: { items: [jobItem], page: 1, pageSize: 25, total: 321 },
    },
  });
}

describe("CompanyPage", () => {
  beforeEach(() => clearResources());

  it("shows the signal, the breakdowns and a jobs table that stays on our site", async () => {
    stub();
    renderWithRouter(ui, options);

    await screen.findByRole("heading", { name: "Stripe", level: 1 });
    expect(screen.getByText("1,240")).toBeInTheDocument();
    expect(screen.getByText("Ramping")).toBeInTheDocument();
    expect(screen.getByText("Roles by profession")).toBeInTheDocument();
    expect(screen.getByText("$144K–$157K")).toBeInTheDocument();

    const job = await screen.findByRole("link", { name: "Staff Engineer" });
    expect(job).toHaveAttribute("href", "/jobs/kr_open12");
    expect(
      screen.getByRole("link", { name: "See all jobs at Stripe" }),
    ).toHaveAttribute("href", "/jobs?company=stripe");

    const outbound = screen
      .getAllByRole("link")
      .filter((link) => /^https?:/.test(link.getAttribute("href") ?? ""));
    expect(outbound).toEqual([]);
  });

  it("links a skill with a page and leaves one without as plain text", async () => {
    stub();
    renderWithRouter(ui, options);
    expect((await screen.findByText("Go")).closest("a")).toHaveAttribute(
      "href",
      "/skills/go",
    );
    expect(screen.getByText("Payments").closest("a")).toBeNull();
  });

  it("leaves out a change that has no full window", async () => {
    stub();
    renderWithRouter(ui, options);
    await screen.findByText(/this week/);
    expect(screen.queryByText(/over 30 days/)).not.toBeInTheDocument();
  });

  it("still opens for a company with no counted roles", async () => {
    stub({ ...companyPayload, facets: null, flow: null, signal: null });
    renderWithRouter(ui, options);
    await screen.findByRole("heading", { name: "Stripe", level: 1 });
    expect(screen.queryByText("Roles by profession")).not.toBeInTheDocument();
  });
});
