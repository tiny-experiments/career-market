import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// One .env at the repository root serves every service (packages/core/src/config.ts reads it).
// forceReload: Next has already loaded (and cached) the app directory's env files.
loadEnvConfig(path.resolve(process.cwd(), '../..'), process.env.NODE_ENV !== 'production', console, true);

const config: NextConfig = {
  // @cm/core ships TypeScript sources.
  transpilePackages: ['@cm/core'],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
