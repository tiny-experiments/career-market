import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/layout";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("ThemeToggle", () => {
  it("starts dark and swaps to light on a press", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <ThemeToggle />
        </TooltipProvider>
      </ThemeProvider>,
    );
    const button = await screen.findByRole("button", {
      name: "Switch to light theme",
    });
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    await user.click(button);
    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeInTheDocument();
  });
});
