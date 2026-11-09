import { vi } from "vitest";

export interface StubbedResponse {
  readonly status?: number;
  readonly body?: unknown;
}

/** The API's paths this test expects, and what each answers. */
export type Routes = Record<string, StubbedResponse | undefined>;

const json = ({ status = 200, body }: StubbedResponse) =>
  new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * Replaces `fetch` with a table of answers by URL. Unknown URLs answer 404 the
 * way the API does. Returns the mock, so a test can count the requests.
 */
export function stubFetch(routes: Routes = {}) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    init?.signal?.throwIfAborted();
    const match = routes[String(input)];
    return json(
      match ?? {
        status: 404,
        body: { message: "Resource not found", code: "NOT_FOUND" },
      },
    );
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** A `fetch` whose answers the test releases by hand. */
export function stubDeferredFetch() {
  const calls: {
    readonly url: string;
    readonly signal: AbortSignal | undefined;
    readonly answer: (response: StubbedResponse) => void;
    readonly fail: (cause: unknown) => void;
  }[] = [];
  const mock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        calls.push({
          url: String(input),
          signal: init?.signal ?? undefined,
          answer: (response) => resolve(json(response)),
          fail: reject,
        });
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  vi.stubGlobal("fetch", mock);
  return { mock, calls };
}
