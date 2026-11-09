import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { useResource } from "@/hooks";
import { clearResources, read, type Resource } from "@/lib/api";
import { stubDeferredFetch, stubFetch } from "../support/fetchStub";

interface Answer {
  readonly n: number;
}
const x = () => read<Answer>("/api/x");
const y = () => read<Answer>("/api/y");

beforeEach(() => clearResources());

describe("useResource", () => {
  it("loads, then answers", async () => {
    stubFetch({ "/api/x": { body: { n: 1 } } });
    const { result } = renderHook(() => useResource(x()));
    expect(result.current).toMatchObject({ data: null, loading: true });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    expect(result.current).toMatchObject({ loading: false, error: null });
  });

  it("reads nothing for a null resource", () => {
    const mock = stubFetch();
    const { result } = renderHook(() => useResource(null));
    expect(result.current).toMatchObject({ data: null, loading: false });
    expect(mock).not.toHaveBeenCalled();
  });

  it("renders a known answer on the first pass, with no request", async () => {
    const mock = stubFetch({ "/api/x": { body: { n: 1 } } });
    const first = renderHook(() => useResource(x()));
    await waitFor(() => expect(first.result.current.data).not.toBeNull());
    first.unmount();

    const seen: (Answer | null)[] = [];
    renderHook(() => {
      const state = useResource(x());
      seen.push(state.data);
      return state;
    });
    expect(seen[0]).toEqual({ n: 1 });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("makes one request in StrictMode", async () => {
    const mock = stubFetch({ "/api/x": { body: { n: 1 } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result } = renderHook(() => useResource(x()), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("shares one request between components", async () => {
    const mock = stubFetch({ "/api/x": { body: { n: 7 } } });
    function Reader() {
      return <p>{useResource(x()).data?.n ?? "…"}</p>;
    }
    render(
      <>
        <Reader />
        <Reader />
      </>,
    );
    await waitFor(() => expect(screen.getAllByText("7")).toHaveLength(2));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("shows nothing from the old key on a new one, and aborts the old read", async () => {
    const { calls } = stubDeferredFetch();
    const { result, rerender } = renderHook(
      ({ resource }: { resource: Resource<Answer> }) => useResource(resource),
      { initialProps: { resource: x() } },
    );
    rerender({ resource: y() });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(calls[0]?.signal?.aborted).toBe(true));
    act(() => calls[1]?.answer({ body: { n: 2 } }));
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
  });

  it("describes a failure in plain words, and retries on reload", async () => {
    const { calls } = stubDeferredFetch();
    const { result } = renderHook(() => useResource(x()));
    act(() =>
      calls[0]?.answer({ status: 429, body: { code: "RATE_LIMITED" } }),
    );
    await waitFor(() =>
      expect(result.current.error).toMatchObject({ code: "RATE_LIMITED" }),
    );
    expect(result.current.error?.message).not.toContain("RATE_LIMITED");

    act(() => result.current.reload());
    await waitFor(() => expect(calls).toHaveLength(2));
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.loading).toBe(true);
    act(() => calls[1]?.answer({ body: { n: 3 } }));
    await waitFor(() => expect(result.current.data).toEqual({ n: 3 }));
  });
});
