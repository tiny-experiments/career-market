import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { stubDeviceTheme } from "../support/mediaQuery";

function renderToggle() {
  return render(
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
    >
      <TooltipProvider>
        <ThemeToggle />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

const root = document.documentElement;

describe("ThemeToggle", () => {
  afterEach(() => localStorage.clear());

  it("follows the device by default and stores nothing", async () => {
    stubDeviceTheme(false);
    renderToggle();
    expect(
      await screen.findByRole("button", { name: "Theme: System" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(root).toHaveClass("light"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("switches live when the device switches", async () => {
    const device = stubDeviceTheme(false);
    renderToggle();
    await waitFor(() => expect(root).toHaveClass("light"));
    act(() => device.set(true));
    await waitFor(() => expect(root).toHaveClass("dark"));
    expect(root).not.toHaveClass("light");
    act(() => device.set(false));
    await waitFor(() => expect(root).toHaveClass("light"));
  });

  it("offers Light, Dark and System with System checked", async () => {
    stubDeviceTheme(true);
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: "Theme: System" }));
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "Light",
      "Dark",
      "System",
    ]);
    expect(
      screen.getByRole("menuitemradio", { name: "System" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("keeps a picked theme over the device until System is picked again", async () => {
    const device = stubDeviceTheme(true);
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: "Theme: System" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Light" }),
    );
    await waitFor(() => expect(root).toHaveClass("light"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => device.set(true));
    expect(root).toHaveClass("light");

    await user.click(screen.getByRole("button", { name: "Theme: Light" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "System" }),
    );
    await waitFor(() => expect(root).toHaveClass("dark"));
  });

  it("keeps a pick stored by the old toggle", async () => {
    stubDeviceTheme(true);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    renderToggle();
    expect(
      await screen.findByRole("button", { name: "Theme: Light" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(root).toHaveClass("light"));
  });
});
