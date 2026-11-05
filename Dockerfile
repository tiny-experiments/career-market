# Server image for the read API and the nightly builder (the VPS side).
# The web app is not in this image: it deploys separately (Vercel).
FROM node:22-slim
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NODE_ENV=production \
    KRILL_CACHE_DIR=/var/cache/krill
RUN corepack enable && mkdir -p /var/cache/krill && chown node:node /var/cache/krill
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/builder/package.json apps/builder/
RUN pnpm install --frozen-lockfile --prod --filter @cm/api... --filter @cm/builder...

COPY packages/core packages/core
COPY apps/api/src apps/api/src
COPY apps/builder/src apps/builder/src

USER node
EXPOSE 4100
# Default: the read API. The builder service overrides working dir and command.
WORKDIR /app/apps/api
CMD ["node", "--import", "tsx", "src/server.ts"]
