# Build image for Anthropic's OSS Scanner (https://github.com/anthropics/oss-scanner), not a deployment image (that is
# /Dockerfile). It installs every dependency and builds the server, CLI and browser bundles while the network is
# available, so the offline audit can run the test suites and start the server. See threat_model.md for how.
FROM oven/bun:1.4

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

RUN bun install --frozen-lockfile && bun run build:all

# The server reads .env; keep its data under /tmp instead of the /mnt/data volume of the deployment image.
RUN cp .env.dist .env
ENV DB_PATH=/tmp/exelearning/exelearning.db \
    FILES_DIR=/tmp/exelearning/
