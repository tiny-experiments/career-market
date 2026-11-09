import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearResources, peek } from "@/lib/api";
import {
  preloadPages,
  prefetchPath,
  resetPrefetchBudget,
} from "@/lib/prefetch";
import { pageRoutes } from "@/routes";
import { stubFetch } from "../support/fetchStub";

beforeEach(() => {
  clearResources();
  resetPrefetchBudget();
});

describe("prefetchPath", () => {
  it("fetches a detail page's data ahead of the click", () => {
    const mock = stubFetch({ "/api/professions/swe": { body: {} } });
    prefetchPath("/professions/swe");
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0]?.[0]).toBe("/api/professions/swe");
    expect(peek("/api/professions/swe")?.pending).toBe(true);
  });

  it("uses the same read the page will, filters and all", () => {
    const mock = stubFetch();
    prefetchPath("/companies?signal=ramping&page=2");
    expect(mock.mock.calls[0]?.[0]).toBe(
      "/api/companies?page=2&pageSize=50&signal=ramping",
    );
  });

  it("does not ask twice for the same page", () => {
    const mock = stubFetch();
    prefetchPath("/skills/python");
    prefetchPath("/skills/python");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("ignores addresses that are not pages", () => {
    const mock = stubFetch();
    prefetchPath("/nowhere/at/all");
    prefetchPath("/about");
    expect(mock).not.toHaveBeenCalled();
  });

  it("stops at the budget, so sweeping a table cannot burn the rate limit", () => {
    const mock = stubFetch();
    for (let i = 0; i < 60; i += 1) prefetchPath(`/skills/skill-${i}`);
    expect(mock).toHaveBeenCalledTimes(30);
  });

  it("does nothing for a visitor saving data", () => {
    const mock = stubFetch();
    vi.stubGlobal("navigator", { connection: { saveData: true } });
    prefetchPath("/skills/python");
    preloadPages();
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("the page map", () => {
  it("resolves every page's chunk to a component", async () => {
    const pages = await Promise.all(pageRoutes.map((route) => route.page()));
    pages.forEach((page) => expect(page.Component).toBeTypeOf("function"));
  });
});
