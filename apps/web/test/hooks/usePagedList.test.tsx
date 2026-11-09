import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { usePagedList } from "@/hooks";
import { clearResources, read, type Page, type PageQuery } from "@/lib/api";
import { stubDeferredFetch, stubFetch } from "../support/fetchStub";

const list = (query: { q?: string } & PageQuery) =>
  read<Page<string>>("/api/list", { ...query });

const page = (n: number, items: string[], total = 120) => ({
  body: { items, page: n, pageSize: 50, total },
});

const url = (n: number) => `/api/list?page=${n}&pageSize=50`;

/** The router under the hook, so a test can read the address it changes. */
function atPath(path: string) {
  let router: ReturnType<typeof createMemoryRouter> | undefined;
  const wrapper = ({ children }: { children: ReactNode }) => {
    router ??= createMemoryRouter([{ path: "/list", element: children }], {
      initialEntries: [path],
    });
    return <RouterProvider router={router} />;
  };
  return { wrapper, search: () => router?.state.location.search };
}

const noFilters = {};

beforeEach(() => clearResources());

describe("usePagedList", () => {
  it("takes the page from the address", async () => {
    stubFetch({ [url(2)]: page(2, ["b"]) });
    const { wrapper } = atPath("/list?page=2");
    const { result } = renderHook(() => usePagedList(list, noFilters), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items).toEqual(["b"]));
    expect(result.current).toMatchObject({
      page: 2,
      total: 120,
      pageCount: 3,
      loading: false,
    });
  });

  it("keeps the rows on screen while the next page loads, and moves the address", async () => {
    const { calls } = stubDeferredFetch();
    const { wrapper, search } = atPath("/list");
    const { result } = renderHook(() => usePagedList(list, noFilters), {
      wrapper,
    });
    act(() => calls[0]?.answer(page(1, ["a"])));
    await waitFor(() => expect(result.current.items).toEqual(["a"]));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(search()).toBe("?page=2"));
    expect(result.current).toMatchObject({ items: ["a"], loading: true });

    act(() => calls[1]?.answer(page(2, ["b"])));
    await waitFor(() => expect(result.current.items).toEqual(["b"]));

    act(() => result.current.setPage(1));
    await waitFor(() => expect(search()).toBe(""));
  });

  it("steps back from a page past the end of the list", async () => {
    stubFetch({
      [url(9)]: page(9, [], 120),
      [url(3)]: page(3, ["c"], 120),
    });
    const { wrapper, search } = atPath("/list?page=9");
    const { result } = renderHook(() => usePagedList(list, noFilters), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items).toEqual(["c"]));
    expect(search()).toBe("?page=3");
  });

  it("drops stale rows when the page fails, so the error can show", async () => {
    const { calls } = stubDeferredFetch();
    const { wrapper } = atPath("/list");
    const { result } = renderHook(() => usePagedList(list, noFilters), {
      wrapper,
    });
    act(() => calls[0]?.answer(page(1, ["a"])));
    await waitFor(() => expect(result.current.items).toEqual(["a"]));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(calls).toHaveLength(2));
    act(() => calls[1]?.answer({ status: 500, body: { code: "INTERNAL" } }));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeNull();
  });
});
