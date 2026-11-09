import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { JobsPulseStrip } from "@/components/jobs/JobsPulseStrip";
import { clearResources } from "@/lib/api";
import { stubFetch } from "../support/fetchStub";
import { renderWithRouter } from "../support/renderWithRouter";

const PULSE = {
  open: 100,
  newToday: 3,
  withPay: 40,
  change1w: 0.01,
  openSpark: [99, 100],
  newSpark: [2, 3],
  workModes: { remote: 1, hybrid: 1, onsite: 1 },
  professions: [],
};

beforeEach(() => clearResources());

describe("JobsPulseStrip", () => {
  it("shows the market cards once the read lands", async () => {
    stubFetch({ "/api/jobs/pulse": { body: PULSE } });
    renderWithRouter(<JobsPulseStrip />);
    expect(await screen.findByText("100")).toBeInTheDocument();
  });

  it("leaves no strip behind when the read fails", async () => {
    stubFetch({
      "/api/jobs/pulse": { status: 500, body: { message: "down", code: "INTERNAL" } },
    });
    const { container } = renderWithRouter(<JobsPulseStrip />);
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Loading" })).toBeNull(),
    );
    expect(container.querySelector("a")).toBeNull();
  });
});
