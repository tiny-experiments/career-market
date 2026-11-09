import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logo } from "@/components/data";

const mark = () => document.querySelector("img");

describe("Logo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
    expect(mark()).toBeNull();
  });

  it("stays a monogram without a logo client id", async () => {
    vi.stubEnv("VITE_CONTEXT_DEV_PUBLIC_CLIENT_ID", "");
    render(<Logo name="Stripe" domain="stripe.com" />);
    expect(await screen.findByText("S")).toBeInTheDocument();
    expect(mark()).toBeNull();
  });

  it("loads the mark lazily, with the default referrer policy", () => {
    vi.stubEnv("VITE_CONTEXT_DEV_PUBLIC_CLIENT_ID", "brandLL_test");
    render(<Logo name="Stripe" domain="stripe.com" />);
    const img = mark()!;
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).not.toHaveAttribute("referrerpolicy");
    const url = new URL(img.getAttribute("src")!);
    expect(url.searchParams.get("publicClientId")).toBe("brandLL_test");
    expect(url.searchParams.get("domain")).toBe("stripe.com");
    expect(url.searchParams.get("theme")).toMatch(/^(light|dark)$/);
  });

  it("keeps the monogram visible until the mark has loaded", () => {
    vi.stubEnv("VITE_CONTEXT_DEV_PUBLIC_CLIENT_ID", "brandLL_test");
    render(<Logo name="Stripe" domain="stripe.com" />);
    expect(mark()).toHaveClass("opacity-0");
    expect(screen.getByText("S")).toBeInTheDocument();
    fireEvent.load(mark()!);
    expect(mark()).toHaveClass("opacity-100");
  });

  it("falls back to the monogram when the mark fails", () => {
    vi.stubEnv("VITE_CONTEXT_DEV_PUBLIC_CLIENT_ID", "brandLL_test");
    render(<Logo name="Stripe" domain="stripe.com" />);
    fireEvent.error(mark()!);
    expect(mark()).toBeNull();
    expect(screen.getByText("S")).toBeInTheDocument();
  });
});
