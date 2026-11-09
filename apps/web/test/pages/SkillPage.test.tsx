import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Navigate } from "react-router";
import { clearResources } from "@/lib/api";
import { SkillPage } from "@/pages/SkillPage";
import { skillPayload } from "../support/directoryFixtures";
import { stubFetch } from "../support/fetchStub";
import { renderWithRouter } from "../support/renderWithRouter";

const ui = <Navigate to="/skills/python" />;
const options = {
  path: "/",
  extraRoutes: [{ path: "/skills/:slug", element: <SkillPage /> }],
};

describe("SkillPage", () => {
  beforeEach(() => clearResources());

  it("shows the headline, pay and pairs without internal notes", async () => {
    stubFetch({ "/api/skills/python": { body: skillPayload } });
    renderWithRouter(ui, options);

    await screen.findByRole("heading", { name: "Python", level: 1 });
    expect(screen.getByText("93,444")).toBeInTheDocument();
    expect(screen.getByText("$141K–$212K")).toBeInTheDocument();
    expect(screen.getByText("Paired with")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Internal note");
    expect(document.body.textContent).not.toContain("Needs 50 roles");
  });

  it("sends roles to our job page and companies to our company page", async () => {
    stubFetch({ "/api/skills/python": { body: skillPayload } });
    renderWithRouter(ui, options);

    expect(
      await screen.findByRole("link", { name: "Data Scientist" }),
    ).toHaveAttribute("href", "/jobs/kr_open12");
    expect(screen.getByRole("link", { name: "Stripe" })).toHaveAttribute(
      "href",
      "/companies/stripe",
    );
    expect(
      screen.getByRole("link", { name: "See all 93,444 jobs" }),
    ).toHaveAttribute("href", "/jobs?skill=lang%3Apython");
  });
});
