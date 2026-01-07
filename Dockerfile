# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3

################################################################################
# OCI Image Spec Build Arguments
# These should be provided at build time for full compliance
# See: https://github.com/opencontainers/image-spec/blob/main/annotations.md
################################################################################
ARG VERSION=0.0.0-alpha
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown

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

# Re-declare ARGs after FROM to make them available in this stage
ARG VERSION
ARG VCS_REF
ARG BUILD_DATE
ARG BUN_VERSION

# OCI Image Spec Annotations
# https://github.com/opencontainers/image-spec/blob/main/annotations.md
LABEL org.opencontainers.image.title="eXeLearning" \
      org.opencontainers.image.description="Open-source educational content authoring tool for creating interactive learning materials in SCORM, HTML5, EPUB3, and IMS formats" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.authors="INTEF <cedec@educacion.gob.es>" \
      org.opencontainers.image.url="https://exelearning.net" \
      org.opencontainers.image.documentation="https://exelearning.github.io/exelearning/" \
      org.opencontainers.image.source="https://github.com/exelearning/exelearning" \
      org.opencontainers.image.vendor="INTEF - Instituto Nacional de Tecnologías Educativas y de Formación del Profesorado" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.base.name="docker.io/oven/bun:${BUN_VERSION}-alpine"

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