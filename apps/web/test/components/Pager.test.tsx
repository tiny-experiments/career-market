import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pager } from "@/components/data";
import { renderWithRouter } from "../support/renderWithRouter";

const hrefFor = (page: number) => `/companies?page=${page}`;

describe("Pager", () => {
  it("links every page it shows and marks the current one", () => {
    renderWithRouter(<Pager page={2} pageCount={366} hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/companies?page=1",
    );
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/companies?page=3",
    );
    expect(screen.getByRole("link", { name: "Page 366" })).toBeInTheDocument();
  });

  it("disables the way back on the first page", () => {
    renderWithRouter(<Pager page={1} pageCount={9} hrefFor={hrefFor} />);
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/companies?page=2",
    );
  });

  it("draws nothing for a single page", () => {
    renderWithRouter(<Pager page={1} pageCount={1} hrefFor={hrefFor} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
