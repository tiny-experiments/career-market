import { screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";
import { JobsTable } from "@/components/jobs";
import { jobRowFromList } from "@/lib/jobRows";
import { jobListItem } from "../support/jobFixtures";
import { renderWithRouter } from "../support/renderWithRouter";

function show(items = [jobListItem()]) {
  return renderWithRouter(
    <ThemeProvider attribute="class">
      <JobsTable rows={items.map(jobRowFromList)} />
    </ThemeProvider>,
  );
}

describe("JobsTable", () => {
  it("opens our own job page from the row, and offers no way off the site", () => {
    show();
    const link = screen.getByRole("link", {
      name: "Staff Engineer at Stripe",
    });
    expect(link).toHaveAttribute("href", "/jobs/kr_open12");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows pay in words and says when none is listed", () => {
    show([
      jobListItem(),
      jobListItem({ id: "kr_nopay", salary: null, href: "/jobs/kr_nopay" }),
    ]);
    expect(screen.getByText("$190K–$240K")).toBeInTheDocument();
    expect(screen.getByText("Not listed")).toBeInTheDocument();
  });

  it("starts the age with a capital and flags a repost in a word", () => {
    show([jobListItem({ ageDays: 0, repostCount: 2 })]);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Reposted")).toBeInTheDocument();
  });
});
