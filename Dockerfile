# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3
ARG VERSION=v0.0.0-alpha

################################################################################
# Base image for reuse
################################################################################
# Debian/glibc avoids native dependency issues with packages that expect *-gnu
# binaries, such as @napi-rs/canvas on some platforms.
FROM oven/bun:${BUN_VERSION}-debian AS base

WORKDIR /app

################################################################################
# Dependencies stage
################################################################################
FROM base AS deps

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

################################################################################
# Build stage
################################################################################
FROM deps AS builder

COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY views/ ./views/
COPY assets/ ./assets/
COPY public/ ./public/

RUN bun run build:all && \
    ls -la public/style/workarea/main.css && \
    ls -la dist/ && \
    ls -la public/app/app.bundle.js && \
    ls -la public/app/yjs/importers.bundle.js && \
    ls -la public/app/yjs/exporters.bundle.js && \
    ls -la public/bundles/

# Prune dev dependencies after build
RUN rm -rf node_modules && \
    bun install --production --frozen-lockfile && \
    rm -rf ~/.bun/install/cache

################################################################################
# Production stage
################################################################################
FROM base AS production

ARG VERSION

LABEL maintainer="INTEF <cedec@educacion.gob.es>" \
      org.opencontainers.image.title="eXeLearning" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      dumb-init \
      ca-certificates \
      wget \
      netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    APP_ENV=prod \
    APP_DEBUG=0

# Copy everything from builder
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/assets ./assets

# Runtime files
COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun views/ ./views/
COPY --chown=bun:bun translations/ ./translations/
COPY --chown=bun:bun docker-entrypoint.sh ./

RUN mkdir -p /app/data /mnt/data && \
    chown -R bun:bun /app/data /mnt/data && \
    chmod +x docker-entrypoint.sh

USER bun

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:${APP_PORT:-8080}/healthcheck || exit 1

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]

CMD ["bun", "run", "dist/index.js"]