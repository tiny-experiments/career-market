import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCardPages } from "@/hooks";

const ROW = 40;

function Card({ total }: { readonly total: number }) {
  const { listRef, start, end, pager } = useCardPages(total);
  const rows = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <>
      <p>
        {pager.page}/{pager.pageCount}
      </p>
      <button onClick={pager.onNext}>next</button>
      <div ref={listRef} data-testid="box">
        <ol>
          {rows.slice(start, end).map((row) => (
            <li key={row}>Row {row}</li>
          ))}
        </ol>
      </div>
    </>
  );
}

/** Lays the box out at `height` and each row at 40 px. */
function layOut(height: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const h = this.tagName === "LI" ? ROW : height;
      return {
        height: h,
        width: 0,
        top: 0,
        left: 0,
        bottom: h,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    },
  );
}

let resize: (() => void) | undefined;
function observeResizes() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe(): void {}
      disconnect(): void {}
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  resize = undefined;
});

describe("useCardPages", () => {
  it("shows five rows a page before layout", () => {
    render(<Card total={12} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("fills a taller box with as many rows as fit", () => {
    layOut(ROW * 8 + 12);
    render(<Card total={12} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("never shows fewer than five, even in a box sized to the last page", () => {
    layOut(ROW * 2);
    render(<Card total={12} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("keeps the reader on a real page when the box grows", () => {
    observeResizes();
    render(<Card total={12} />);
    fireEvent.click(screen.getByText("next"));
    fireEvent.click(screen.getByText("next"));
    expect(screen.getByText("3/3")).toBeInTheDocument();

    layOut(ROW * 12);
    act(() => resize?.());
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
  });
});
