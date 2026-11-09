import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Logo } from "@/components/data";

describe("Logo", () => {
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

  it("asks the logo service for a known domain when the id is set", () => {
    vi.stubEnv("VITE_LOGO_LINK_ID", "brandLL_test");
    render(<Logo name="Stripe" domain="stripe.com" />);
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveAttribute("data-shape", "round");
  });
});
