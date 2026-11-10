import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniList, MiniRow, MiniStat } from "@/components/data";
import { renderWithRouter } from "../support/renderWithRouter";

describe("MiniStat", () => {
  it("shows the label, the figure and the change in words", () => {
    renderWithRouter(
      <MiniStat
        label="Tech Hiring Index"
        value="302,336"
        change={0.022}
        suffix="this week"
      />,
    );
    expect(screen.getByText("Tech Hiring Index")).toBeInTheDocument();
    expect(screen.getByText("302,336")).toBeInTheDocument();
    expect(screen.getByLabelText("Up 2.2% this week")).toBeInTheDocument();
  });

  it("is one link when it has somewhere to go, with the (i) beside it and not inside", () => {
    renderWithRouter(
      <MiniStat
        label="New today"
        value="576"
        to="/jobs?posted=1d"
        hint={{ text: "Roles first seen today." }}
      />,
    );
    const link = screen.getByRole("link", { name: /New today/ });
    expect(link).toHaveAttribute("href", "/jobs?posted=1d");
    const about = screen.getByRole("button", { name: "About New today" });
    expect(link).not.toContainElement(about);
  });
});

describe("MiniList", () => {
  const items = ["Web", "Data", "Infra", "Design"].map((name, index) => ({
    rank: index + 1,
    name,
    value: String(100 - index),
    change: 0.05,
    to: `/professions/${name.toLowerCase()}`,
  }));

  it("shows the top three rows, each a link, under a title that opens the rest", () => {
    renderWithRouter(
      <MiniList
        title="Professions gaining"
        to="/professions?view=gaining"
        items={items}
        empty="No profession grew this week."
      />,
    );
    const list = screen.getByRole("region", { name: "Professions gaining" });
    expect(
      within(list).getByRole("link", { name: "Professions gaining" }),
    ).toHaveAttribute("href", "/professions?view=gaining");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).queryByText("Design")).toBeNull();
  });

  it("says so when nothing qualifies", () => {
    renderWithRouter(
      <MiniList
        title="Professions gaining"
        to="/professions?view=gaining"
        items={[]}
        empty="No profession grew this week."
      />,
    );
    expect(
      screen.getByText("No profession grew this week."),
    ).toBeInTheDocument();
  });
});

describe("MiniRow", () => {
  it("names its tiles as one group", () => {
    renderWithRouter(
      <MiniRow label="The market at a glance">
        <MiniStat label="Closed today" value="771" />
      </MiniRow>,
    );
    expect(
      within(
        screen.getByRole("group", { name: "The market at a glance" }),
      ).getByText("771"),
    ).toBeInTheDocument();
  });
});
