import { defineConfig } from 'vitest/config';

// Two projects: Node for the services and shared packages, and the Vite app's
// own config (jsdom + Testing Library) for its components. `pnpm test` runs both.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'apps/web/**'],
          environment: 'node',
        },
      },
      'apps/web/vite.config.ts',
    ],
  },
});
