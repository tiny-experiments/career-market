import { defineConfig, devices } from "@playwright/test";

/** Where the phone checks serve the production build. */
const PORT = 4317;

/**
 * Browser checks of the production build (`pnpm --filter @cm/web run test:phone`).
 * The API is answered from recorded fixtures, so a run needs no network.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `vite build --logLevel warn && vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
