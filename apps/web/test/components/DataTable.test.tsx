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
});
