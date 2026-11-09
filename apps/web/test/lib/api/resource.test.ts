import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearResources,
  FAILED_MS,
  fetchResource,
  FRESH_MS,
  isCovered,
  KEEP_MS,
  peek,
  read,
  subscribe,
} from "@/lib/api";
import { stubDeferredFetch, stubFetch } from "../../support/fetchStub";

const settle = () =>
  vi.waitFor(() => expect(peek("/api/x")?.pending).toBe(false));

beforeEach(() => clearResources());
afterEach(() => vi.useRealTimers());

describe("the resource store", () => {
  it("joins concurrent readers into one request", async () => {
    const { mock, calls } = stubDeferredFetch();
    fetchResource(read("/api/x"));
    fetchResource(read("/api/x"));
    expect(mock).toHaveBeenCalledTimes(1);
    calls[0]?.answer({ body: { n: 1 } });
    await settle();
    expect(peek("/api/x")?.data).toEqual({ n: 1 });
  });

  it("uses a fresh answer without asking again", async () => {
    const mock = stubFetch({ "/api/x": { body: { n: 1 } } });
    fetchResource(read("/api/x"));
    await settle();
    fetchResource(read("/api/x"));
    expect(mock).toHaveBeenCalledTimes(1);
    expect(isCovered("/api/x")).toBe(true);
  });

  it("asks again once an answer is stale, keeping it on show meanwhile", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const mock = stubFetch({ "/api/x": { body: { n: 1 } } });
    fetchResource(read("/api/x"));
    await settle();
    vi.setSystemTime(Date.now() + FRESH_MS + 1);
    fetchResource(read("/api/x"));
    expect(mock).toHaveBeenCalledTimes(2);
    expect(peek("/api/x")).toMatchObject({ data: { n: 1 }, pending: true });
    await settle();
  });

  it("forgets an answer past the keep window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    stubFetch({ "/api/x": { body: { n: 1 } } });
    fetchResource(read("/api/x"));
    await settle();
    vi.setSystemTime(Date.now() + KEEP_MS + 1);
    expect(peek("/api/x")).toBeUndefined();
  });

  it("asks again when forced", async () => {
    const mock = stubFetch({ "/api/x": { body: { n: 1 } } });
    fetchResource(read("/api/x"));
    await settle();
    fetchResource(read("/api/x"), { force: true });
    expect(mock).toHaveBeenCalledTimes(2);
    await settle();
  });

  it("keeps the old answer when a refresh fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { calls } = stubDeferredFetch();
    fetchResource(read("/api/x"));
    calls[0]?.answer({ body: { n: 1 } });
    await settle();
    vi.setSystemTime(Date.now() + FRESH_MS + 1);
    fetchResource(read("/api/x"));
    calls[1]?.answer({ status: 503, body: { code: "NOT_READY" } });
    await settle();
    expect(peek("/api/x")?.data).toEqual({ n: 1 });
    expect(peek("/api/x")?.error).toMatchObject({ code: "NOT_READY" });
  });

  it("does not repeat a read that just failed, until asked or later", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const mock = stubFetch();
    fetchResource(read("/api/x"));
    await settle();
    fetchResource(read("/api/x"));
    expect(mock).toHaveBeenCalledTimes(1);
    expect(isCovered("/api/x")).toBe(true);

    fetchResource(read("/api/x"), { force: true });
    expect(mock).toHaveBeenCalledTimes(2);
    await settle();

    vi.setSystemTime(Date.now() + FAILED_MS + 1);
    fetchResource(read("/api/x"));
    expect(mock).toHaveBeenCalledTimes(3);
    await settle();
  });

  it("stops the request when the last reader leaves", async () => {
    const { calls } = stubDeferredFetch();
    const first = new AbortController();
    const second = new AbortController();
    fetchResource(read("/api/x"), { signal: first.signal });
    fetchResource(read("/api/x"), { signal: second.signal });
    first.abort();
    await Promise.resolve();
    expect(calls[0]?.signal?.aborted).toBe(false);
    second.abort();
    await vi.waitFor(() => expect(calls[0]?.signal?.aborted).toBe(true));
    await vi.waitFor(() => expect(peek("/api/x")).toBeUndefined());
  });

  it("survives a remount in the same tick (StrictMode)", async () => {
    const { mock, calls } = stubDeferredFetch();
    const first = new AbortController();
    fetchResource(read("/api/x"), { signal: first.signal });
    first.abort();
    fetchResource(read("/api/x"), { signal: new AbortController().signal });
    await Promise.resolve();
    await Promise.resolve();
    expect(mock).toHaveBeenCalledTimes(1);
    expect(calls[0]?.signal?.aborted).toBe(false);
  });

  it("never cancels a prefetch when a reader leaves", async () => {
    const { calls } = stubDeferredFetch();
    fetchResource(read("/api/x"));
    const reader = new AbortController();
    fetchResource(read("/api/x"), { signal: reader.signal });
    reader.abort();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls[0]?.signal?.aborted).toBe(false);
  });

  it("does not let a cancelled request settle its replacement", async () => {
    const { calls } = stubDeferredFetch();
    const first = new AbortController();
    fetchResource(read("/api/x"), { signal: first.signal });
    first.abort();
    await vi.waitFor(() => expect(calls[0]?.signal?.aborted).toBe(true));
    fetchResource(read("/api/x"));
    await Promise.resolve();
    expect(peek("/api/x")?.pending).toBe(true);
    calls[1]?.answer({ body: { n: 2 } });
    await settle();
    expect(peek("/api/x")?.data).toEqual({ n: 2 });
  });

  it("tells subscribers about every change, until they stop listening", async () => {
    stubFetch({ "/api/x": { body: { n: 1 } } });
    const listener = vi.fn();
    const stop = subscribe("/api/x", listener);
    fetchResource(read("/api/x"));
    await settle();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    fetchResource(read("/api/x"), { force: true });
    expect(listener).toHaveBeenCalledTimes(2);
    await settle();
  });
});
