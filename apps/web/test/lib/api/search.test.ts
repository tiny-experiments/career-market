import { describe, expect, it } from "vitest";
import { companySearch, siteSearch } from "@/lib/api";

describe("site search reads", () => {
  it("cuts a long query to what the API accepts", () => {
    const query = new URL(siteSearch(`  ${"a".repeat(200)}  `).key, "http://x");
    expect(query.searchParams.get("q")).toHaveLength(80);
  });
  it("leaves no trailing space after the cut", () => {
    const query = new URL(siteSearch(`${"a".repeat(79)} b`).key, "http://x");
    expect(query.searchParams.get("q")).toBe("a".repeat(79));
  });
  it("asks for roles on the site search and not the company filter", () => {
    expect(siteSearch("rust", 10).key).toBe(
      "/api/search?limit=10&q=rust&roles=1",
    );
    expect(companySearch("stripe").key).toBe(
      "/api/search?limit=8&q=stripe&roles=0",
    );
  });
});
