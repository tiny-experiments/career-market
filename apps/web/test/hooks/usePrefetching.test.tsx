import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrefetching } from "@/hooks";
import { clearResources } from "@/lib/api";
import { resetPrefetchBudget } from "@/lib/prefetch";
import { stubFetch } from "../support/fetchStub";

function Page() {
  usePrefetching();
  return (
    <>
      <a href="/skills/python">Python</a>
      <a href="https://elsewhere.test/skills/rust">Elsewhere</a>
      <p>Plain text</p>
    </>
  );
}

const ASKED = "/api/skills/python";

beforeEach(() => {
  clearResources();
  resetPrefetchBudget();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("usePrefetching", () => {
  it("fetches once the pointer rests on a link", () => {
    const mock = stubFetch();
    render(<Page />);
    fireEvent.pointerOver(screen.getByText("Python"));
    expect(mock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(70);
    expect(mock.mock.calls.map(([url]) => url)).toEqual([ASKED]);
  });

  it("ignores a link the pointer only crosses", () => {
    const mock = stubFetch();
    render(<Page />);
    fireEvent.pointerOver(screen.getByText("Python"));
    fireEvent.pointerOver(screen.getByText("Plain text"));
    vi.advanceTimersByTime(200);
    expect(mock).not.toHaveBeenCalled();
  });

  it("fetches when the keyboard reaches a link", () => {
    const mock = stubFetch();
    render(<Page />);
    fireEvent.focusIn(screen.getByText("Python"));
    vi.advanceTimersByTime(70);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("leaves other sites alone", () => {
    const mock = stubFetch();
    render(<Page />);
    fireEvent.pointerOver(screen.getByText("Elsewhere"));
    vi.advanceTimersByTime(200);
    expect(mock).not.toHaveBeenCalled();
  });
});
