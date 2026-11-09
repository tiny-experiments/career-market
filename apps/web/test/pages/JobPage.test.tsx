import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { clearResources } from "@/lib/api";
import { JobPage } from "@/pages/JobPage";
import { stubFetch } from "../support/fetchStub";
import { jobPage } from "../support/jobFixtures";
import { TooltipProvider } from "@/components/ui/tooltip";

function open(body: unknown, status = 200) {
  stubFetch({ "/api/jobs/kr_open12": { status, body } });
  const router = createMemoryRouter(
    [{ path: "/jobs/:id", element: <JobPage /> }],
    { initialEntries: ["/jobs/kr_open12"] },
  );
  return render(
    <ThemeProvider attribute="class">
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

const external = () =>
  screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("href")?.startsWith("http"));

beforeEach(() => clearResources());

describe("the job page", () => {
  it("opens on the verdict, ahead of the posting", async () => {
    open(jobPage());
    const verdict = await screen.findByText("First time posted · 5 days ago");
    const posting = screen.getByText("About this role");
    expect(
      verdict.compareDocumentPosition(posting) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText(/usually filled within 34 days/),
    ).toBeInTheDocument();
  });

  it("has exactly one way off the site: the apply button", async () => {
    open(jobPage());
    await screen.findByText("About this role");
    expect(external()).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: /Apply on Stripe’s site/ }),
    ).toHaveAttribute("href", "https://stripe.example/apply/1");
  });

  it("shows no apply button when the posting has nowhere to send you", async () => {
    open(jobPage({ applyUrl: null }));
    await screen.findByText("About this role");
    expect(external()).toHaveLength(0);
  });

  it("still reads well without the employer's text", async () => {
    open(jobPage({ description: null }));
    expect(
      await screen.findByText(
        "The full description is on the employer’s site.",
      ),
    ).toBeInTheDocument();
  });

  it("says plainly when a role has closed and points to what is open", async () => {
    open(
      {
        status: "closed",
        id: "kr_open12",
        closedAt: "2026-11-07",
        openedAt: "2026-10-01",
        openedSource: "posted",
        family: "software",
        familyName: "Software",
      },
      410,
    );
    expect(
      await screen.findByRole("heading", { name: "This role has closed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("It was open for 37 days.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See open roles in Software" }),
    ).toHaveAttribute("href", "/jobs?family=software");
  });

  it("handles a closed role that remembers nothing else", async () => {
    open(
      {
        status: "closed",
        id: "kr_open12",
        closedAt: "2026-11-07",
        openedAt: null,
        openedSource: null,
        family: null,
        familyName: null,
      },
      410,
    );
    await waitFor(() =>
      expect(
        screen.getByText("The employer took the listing down."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: "See open roles" }),
    ).toHaveAttribute("href", "/jobs");
  });
});
