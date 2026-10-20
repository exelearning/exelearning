#!/usr/bin/env bash
# Snapshots system-under-test metrics: host, Docker containers,
# Redis, PostgreSQL. Intended to be called before/during/after a k6 run so
# results can be correlated with a RUN_ID. Read-only, safe to run anytime.
#
# Usage:
#   test/load/scripts/collect-sut.sh <output-file> [label]
#
# Environment variables (all required except SUT_COMPOSE_FILE):
#   SUT_SSH          e.g. deploy@sut-host
#   SUT_COMPOSE_DIR  e.g. /home/deploy/exenew
#   SUT_COMPOSE_FILE default: docker-compose.yml

set -euo pipefail

OUTPUT_FILE="$1"
LABEL="${2:-snapshot}"

: "${SUT_SSH:?Set SUT_SSH to the system-under-test SSH target, e.g. SUT_SSH=deploy@sut-host}"
: "${SUT_COMPOSE_DIR:?Set SUT_COMPOSE_DIR to the deployment compose directory on that host}"
SUT_COMPOSE_FILE="${SUT_COMPOSE_FILE:-docker-compose.yml}"

mkdir -p "$(dirname "${OUTPUT_FILE}")"

# shellcheck disable=SC2087
ssh "${SUT_SSH}" bash <<EOF >"${OUTPUT_FILE}" 2>&1
set -x
echo "== label: ${LABEL} =="
echo "== timestamp: \$(date -u +"%Y-%m-%dT%H:%M:%SZ") =="

echo "== host: uptime =="
uptime

echo "== host: free =="
free -h

echo "== host: socket summary (ss -s) =="
ss -s

echo "== host: open file descriptors (system-wide estimate) =="
cat /proc/sys/fs/file-nr

echo "== host: network device counters =="
cat /proc/net/dev

echo "== docker: compose ps =="
docker compose -f "${SUT_COMPOSE_DIR}/${SUT_COMPOSE_FILE}" ps

echo "== docker: stats (no-stream, all containers) =="
docker stats --no-stream

echo "== docker: per-container open FDs (main process, PID 1 inside each container) =="
for c in \$(docker compose -f "${SUT_COMPOSE_DIR}/${SUT_COMPOSE_FILE}" ps -q); do
    name=\$(docker inspect --format '{{.Name}}' "\$c" | sed 's#^/##')
    fds=\$(docker exec "\$c" sh -c 'ls /proc/1/fd 2>/dev/null | wc -l' 2>/dev/null || echo "n/a")
    echo "\$name: \$fds fds"
done

echo "== redis: info (if present) =="
docker compose -f "${SUT_COMPOSE_DIR}/${SUT_COMPOSE_FILE}" exec -T redis redis-cli info 2>/dev/null || echo "redis not present in this stack"

echo "== postgres: stat_activity (if present) =="
docker compose -f "${SUT_COMPOSE_DIR}/${SUT_COMPOSE_FILE}" exec -T postgres \
    psql -U "\${DB_USER:-postgres}" -d "\${DB_NAME:-exelearning}" -c "select count(*) as connections from pg_stat_activity;" 2>/dev/null \
    || echo "postgres not present in this stack"
EOF

echo "Saved system-under-test snapshot (${LABEL}) to ${OUTPUT_FILE}"
