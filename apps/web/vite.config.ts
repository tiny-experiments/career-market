/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

/** The API's own listener. `VITE_API_URL` points the proxy somewhere else. */
const DEFAULT_API_TARGET = "http://127.0.0.1:4100";

/** The repository root: one `.env` serves every app (only `VITE_*` reaches the browser). */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The browser talks to the dev server and nothing else: `/api` is proxied to
 * the API, so the app is same-origin locally and needs no CORS or environment
 * variable to run.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, "VITE_");
  const target = env["VITE_API_URL"] ?? DEFAULT_API_TARGET;

  return {
    plugins: [react(), tailwindcss()],
    envDir: ROOT,
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        "/api": { target },
      },
    },
    test: {
      include: ["test/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      setupFiles: ["test/support/setup.ts"],
    },
  };
});
