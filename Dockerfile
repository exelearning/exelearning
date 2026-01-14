# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3
ARG VERSION=v0.0.0-alpha

################################################################################
# Base image for reuse
################################################################################
FROM oven/bun:${BUN_VERSION}-alpine AS base
WORKDIR /app

################################################################################
# Dependencies stage - separated for cache efficiency
################################################################################
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install

################################################################################
# Build stage - Compile TypeScript and assets
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
    ls -la public/bundles/manifest.json

# Prune dev dependencies after build
RUN rm -rf node_modules && \
    bun install --production && \
    rm -rf ~/.bun/install/cache

################################################################################
# Production stage
################################################################################
FROM base

ARG VERSION
LABEL maintainer="INTEF <cedec@educacion.gob.es>" \
      org.opencontainers.image.title="eXeLearning" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production \
    APP_ENV=prod \
    APP_DEBUG=0

# Copy everything from builder (already has prod node_modules)
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
  CMD wget -qO- http://localhost:8080/healthcheck || exit 1

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["bun", "run", "dist/index.js"]