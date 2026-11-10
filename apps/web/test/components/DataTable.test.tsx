import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "@/components/data";
import { renderWithRouter } from "../support/renderWithRouter";

interface Row {
  code: string;
  name: string;
  openRoles: number;
}

const ROWS: Row[] = [
  { code: "swe", name: "Software", openRoles: 99_923 },
  { code: "data", name: "Data", openRoles: 19_360 },
];

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Profession", cell: (row) => row.name },
  {
    key: "openRoles",
    header: "Open roles",
    align: "right",
    sortable: true,
    hint: { title: "Open roles", text: "Roles open today." },
    cell: (row) => row.openRoles.toLocaleString("en-US"),
  },
];

/** Classes that make an element a positioning box for an absolute child. */
const POSITIONED = ["relative", "absolute", "fixed", "sticky"];

/**
 * What a tap on `cell` lands on, by the rule a phone's browser paints with: a
 * link cover (`absolute inset-0`, or an `after:` one) fills its nearest
 * positioned ancestor, the last cover in the page sits on top, and a table row
 * is never a positioning box, as in iOS 17 Safari.
 */
function tapTarget(cell: HTMLElement): HTMLElement {
  const covers = [...document.querySelectorAll<HTMLElement>("a")].filter(
    (link) =>
      (link.classList.contains("absolute") &&
        link.classList.contains("inset-0")) ||
      (link.classList.contains("after:absolute") &&
        link.classList.contains("after:inset-0")),
  );
  const boxOf = (cover: HTMLElement): HTMLElement => {
    // An `after:` cover hangs off the link itself; a plain one off its parent.
    let node: HTMLElement | null = cover.classList.contains("after:absolute")
      ? cover
      : cover.parentElement;
    while (node) {
      const positioned = POSITIONED.some((name) =>
        node?.classList.contains(name),
      );
      if (positioned && node.tagName !== "TR") return node;
      node = node.parentElement;
    }
    return document.body;
  };
  const over = covers.filter((cover) => boxOf(cover).contains(cell));
  return over[over.length - 1] ?? cell;
}

describe("DataTable", () => {
  it("makes the row the link and right-aligns the numbers", () => {
    renderWithRouter(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.code}
        rowHref={(row) => `/professions/${row.code}`}
      />,
    );
    const link = screen.getByRole("link", { name: "Software" });
    expect(link).toHaveAttribute("href", "/professions/swe");
    expect(link.className).toContain("after:absolute");
    const header = screen.getByRole("columnheader", { name: /open roles/i });
    expect(header).toHaveClass("text-right");
    const cell = screen.getByRole("cell", { name: "99,923" });
    expect(cell).toHaveClass("text-right");
  });

  it("can carry the link on a later column, with the row index for a rank", () => {
    renderWithRouter(
      <DataTable
        columns={[
          { key: "rank", header: "#", cell: (_row, index) => index + 1 },
          ...COLUMNS,
        ]}
        rows={ROWS}
        rowKey={(row) => row.code}
        rowHref={(row) => `/professions/${row.code}`}
        linkColumn="name"
      />,
    );
    const link = screen.getByRole("link", { name: "Data" });
    expect(link).toHaveTextContent("Data");
    expect(link.closest("td")?.previousElementSibling).toHaveTextContent("2");
  });

  it("sorts from the header and announces the direction", async () => {
    const onSort = vi.fn();
    renderWithRouter(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.code}
        sort={{ key: "openRoles", direction: "desc" }}
        onSort={onSort}
      />,
    );
    const header = screen.getByRole("columnheader", { name: /open roles/i });
    expect(header).toHaveAttribute("aria-sort", "descending");
    await userEvent.click(
      within(header).getByRole("button", { name: "Open roles" }),
    );
    expect(onSort).toHaveBeenCalledWith("openRoles");
  });

  it("explains a column behind an (i) in its header", () => {
    renderWithRouter(
      <DataTable columns={COLUMNS} rows={ROWS} rowKey={(row) => row.code} />,
    );
    expect(
      screen.getByRole("button", { name: "About Open roles" }),
    ).toBeInTheDocument();
  });

  it("shows skeleton rows while loading and the empty state when there is nothing", () => {
    const { rerender } = renderWithRouter(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.code}
        loading
        skeletonRows={3}
      />,
    );
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6);
    rerender(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.code}
        empty={<p>No professions match this view</p>}
      />,
    );
    expect(
      screen.getByText("No professions match this view"),
    ).toBeInTheDocument();
  });
  it("opens each row's own page wherever the row is tapped, even where a row is not a positioning box", async () => {
    const rows: Row[] = [
      { code: "swe", name: "Software", openRoles: 99_923 },
      { code: "data", name: "Data", openRoles: 19_360 },
      { code: "prod", name: "Product", openRoles: 12_004 },
      { code: "game", name: "Games & Graphics", openRoles: 1_210 },
    ];
    const table = (
      <DataTable
        columns={[
          { key: "rank", header: "#", cell: (_row, index) => index + 1 },
          COLUMNS[0]!,
          {
            ...COLUMNS[1]!,
            phoneHeader: "Open · 7D",
            phoneLine: (row: Row) => `${row.code} week`,
          },
        ]}
        rows={rows}
        rowKey={(row) => row.code}
        rowHref={(row) => `/professions/${row.code}`}
        linkColumn="name"
      />
    );
    for (const [index, row] of rows.entries()) {
      for (const column of [0, 1, 2]) {
        // A tap that navigates leaves the list, so each tap gets a fresh one.
        const { unmount } = renderWithRouter(table);
        const tr = screen.getAllByRole("row")[index + 1]!;
        const cell = within(tr).getAllByRole("cell")[column]!;
        await userEvent.click(tapTarget(cell));
        expect(screen.getByTestId("location")).toHaveTextContent(
          `/professions/${row.code}`,
        );
        unmount();
      }
    }
  });

  it("gives a phone a second line under a cell and its own header", () => {
    renderWithRouter(
      <DataTable
        columns={[
          COLUMNS[0]!,
          {
            ...COLUMNS[1]!,
            phoneHeader: "Open · 7D",
            phoneLine: (row: Row) => `${row.code} week`,
          },
        ]}
        rows={ROWS}
        rowKey={(row) => row.code}
      />,
    );
    const line = screen.getByText("swe week");
    expect(line).toHaveClass("md:hidden");
    expect(screen.getByText("Open · 7D")).toHaveClass("md:hidden");
    expect(screen.getByText("Open roles")).toHaveClass("max-md:hidden");
  });
});
