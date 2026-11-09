import { describe, expect, it, vi } from "vitest";
import { logoUrl } from "@/lib/logo";

describe("logoUrl", () => {
  it("asks the logo service for the domain in the current theme", () => {
    const url = new URL(logoUrl("stripe.com", "dark", "brandLL_test")!);
    expect(url.origin).toBe("https://logos.context.dev");
    expect(url.searchParams.get("publicClientId")).toBe("brandLL_test");
    expect(url.searchParams.get("domain")).toBe("stripe.com");
    expect(url.searchParams.get("theme")).toBe("dark");
  });

  it("makes no request without a client id or a domain", () => {
    vi.stubEnv("VITE_CONTEXT_DEV_PUBLIC_CLIENT_ID", "");
    expect(logoUrl("stripe.com", "dark")).toBeNull();
    expect(logoUrl("stripe.com", "dark", "")).toBeNull();
    expect(logoUrl(null, "light", "brandLL_test")).toBeNull();
    expect(logoUrl("", "light", "brandLL_test")).toBeNull();
  });
});
