import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logo } from "@/components/data";

describe("Logo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows a monogram tile when there is no domain", async () => {
    render(<Logo name="Platform & Infra" shape="square" />);
    const fallback = await screen.findByText("PI");
    expect(fallback).toHaveAttribute("data-slot", "avatar-fallback");
    expect(fallback).toHaveClass("rounded-lg");
    expect(document.querySelector('[data-slot="avatar"]')).toHaveAttribute(
      "data-shape",
      "square",
    );
  });

  it("stays a monogram without a logo client id", async () => {
    vi.stubEnv("VITE_LOGO_LINK_ID", "");
    render(<Logo name="Stripe" domain="stripe.com" />);
    expect(await screen.findByText("S")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("asks the logo service for the domain, id and theme when the id is set", async () => {
    vi.stubEnv("VITE_LOGO_LINK_ID", "brandLL_test");
    vi.stubGlobal(
      "Image",
      class extends EventTarget {
        complete = true;
        naturalWidth = 1;
        src = "";
      },
    );
    render(<Logo name="Stripe" domain="stripe.com" />);
    const img = await waitFor(() => {
      const found = document.querySelector("img");
      expect(found).not.toBeNull();
      return found!;
    });
    const url = new URL(img.getAttribute("src")!);
    expect(url.searchParams.get("publicClientId")).toBe("brandLL_test");
    expect(url.searchParams.get("domain")).toBe("stripe.com");
    expect(url.searchParams.get("theme")).toMatch(/^(light|dark)$/);
  });
});
