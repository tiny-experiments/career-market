import { describe, expect, it } from "vitest";
import {
  ApiError,
  buildPath,
  isApiError,
  jobDetail,
  request,
  resolveApiBase,
} from "@/lib/api";
import { stubFetch } from "../../support/fetchStub";

describe("resolveApiBase", () => {
  it("stays same-origin in development, where the dev server proxies /api", () => {
    expect(
      resolveApiBase({ DEV: true, VITE_API_URL: "https://api.test" }),
    ).toBe("");
  });

  it("uses VITE_API_URL in a build, without a trailing slash", () => {
    expect(
      resolveApiBase({ DEV: false, VITE_API_URL: "https://api.test/" }),
    ).toBe("https://api.test");
  });

  it("defaults a build to the local API", () => {
    expect(resolveApiBase({ DEV: false })).toBe("http://127.0.0.1:4100");
    expect(resolveApiBase({ DEV: false, VITE_API_URL: " " })).toBe(
      "http://127.0.0.1:4100",
    );
  });
});

describe("buildPath", () => {
  it("sorts the query and drops blanks, so one query is one URL", () => {
    expect(buildPath("/a", { z: 1, b: undefined, a: "x y" })).toBe(
      "/a?a=x+y&z=1",
    );
    expect(buildPath("/a", { b: undefined })).toBe("/a");
  });
});

describe("request", () => {
  it("returns the parsed answer and sends no credentials", async () => {
    const fetchMock = stubFetch({ "/api/x?page=2": { body: { ok: 1 } } });
    await expect(request("/api/x", { query: { page: 2 } })).resolves.toEqual({
      ok: 1,
    });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: "omit" });
  });

  it("surfaces the API's refusal as a typed error", async () => {
    stubFetch({
      "/api/x": {
        status: 400,
        body: {
          message: "Request validation failed",
          code: "VALIDATION_FAILED",
          fields: { page: "Too small" },
        },
      },
    });
    const error = await request("/api/x").catch((cause: unknown) => cause);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: { fields: { page: "Too small" } },
    });
  });

  it("treats an unknown refusal as an internal error", async () => {
    stubFetch({ "/api/x": { status: 500, body: { code: "WAT" } } });
    await expect(request("/api/x")).rejects.toMatchObject({
      status: 500,
      code: "INTERNAL",
    });
  });

  it("reports an unreachable API as a network error", async () => {
    const down = async () => {
      throw new TypeError("Failed to fetch");
    };
    globalThis.fetch = down as typeof fetch;
    const error = await request("/api/x").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("does not disguise an abort as a failure", async () => {
    stubFetch({ "/api/x": { body: {} } });
    const controller = new AbortController();
    controller.abort();
    await expect(
      request("/api/x", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("refuses a 200 that is not JSON, such as a hosting page", async () => {
    const page = async () => new Response("<html></html>", { status: 200 });
    globalThis.fetch = page as typeof fetch;
    await expect(request("/api/x")).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("reads a closed job's 410 as an answer", async () => {
    stubFetch({
      "/api/jobs/kr_abc123": {
        status: 410,
        body: { status: "closed", id: "kr_abc123" },
      },
    });
    const job = await jobDetail("kr_abc123").load(new AbortController().signal);
    expect(job).toMatchObject({ status: "closed" });
  });
});
