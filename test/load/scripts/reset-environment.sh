#!/usr/bin/env bash
# Destructively resets the Gordobot test deployment: docker compose down -v,
# pull the latest images, and bring it back up. This drops all test data
# (projects, users, Redis, PostgreSQL volumes). Only use this when starting a
# new benchmark from a clean slate is genuinely needed.
#
# Every invocation is appended to test/load/results/reset-log.txt so resets
# stay auditable, per issue #2255's reset-strategy requirements.
#
# Usage:
#   test/load/scripts/reset-environment.sh --yes "<reason>"
#
# Environment variables:
#   GORDOBOT_SSH          default: ernesto@192.168.4.5
#   GORDOBOT_COMPOSE_DIR  default: /home/ernesto/exenew
#   GORDOBOT_COMPOSE_FILE default: docker-compose.yml

set -euo pipefail

if [[ "${1:-}" != "--yes" ]]; then
    echo "Refusing to reset without explicit confirmation." >&2
    echo "Usage: $0 --yes \"<reason for this reset>\"" >&2
    exit 1
fi
REASON="${2:?A reason is required, e.g. 'switching from single-instance to HA topology'}"

GORDOBOT_SSH="${GORDOBOT_SSH:-ernesto@192.168.4.5}"
GORDOBOT_COMPOSE_DIR="${GORDOBOT_COMPOSE_DIR:-/home/ernesto/exenew}"
GORDOBOT_COMPOSE_FILE="${GORDOBOT_COMPOSE_FILE:-docker-compose.yml}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
LOG_FILE="${REPO_ROOT}/test/load/results/reset-log.txt"
mkdir -p "$(dirname "${LOG_FILE}")"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[${TIMESTAMP}] compose=${GORDOBOT_COMPOSE_FILE} reason: ${REASON}" | tee -a "${LOG_FILE}"

ssh "${GORDOBOT_SSH}" \
    "cd '${GORDOBOT_COMPOSE_DIR}' && docker compose -f '${GORDOBOT_COMPOSE_FILE}' down -v && \
     docker compose -f '${GORDOBOT_COMPOSE_FILE}' pull && \
     docker compose -f '${GORDOBOT_COMPOSE_FILE}' up -d"

echo "== Reset complete. Re-run scripts/prepare.sh before the next benchmark. =="
