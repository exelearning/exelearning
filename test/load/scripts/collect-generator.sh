#!/usr/bin/env bash
# Snapshots load-generator host metrics, so we can prove the
# generator itself was not the bottleneck for a given run. Read-only.
#
# Usage:
#   test/load/scripts/collect-generator.sh <output-file> [label]
#
# Environment variables:
#   GENERATOR_SSH  e.g. deploy@load-generator-host

set -euo pipefail

OUTPUT_FILE="$1"
LABEL="${2:-snapshot}"
: "${GENERATOR_SSH:?Set GENERATOR_SSH to the load generator SSH target, e.g. GENERATOR_SSH=deploy@load-generator-host}"

mkdir -p "$(dirname "${OUTPUT_FILE}")"

ssh "${GENERATOR_SSH}" bash <<'EOF' >"${OUTPUT_FILE}" 2>&1
echo "== label: LABEL_PLACEHOLDER =="
echo "== timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ") =="

echo "== host: uptime =="
uptime

echo "== host: free =="
free -h

echo "== host: CPU (mpstat 1 2) =="
mpstat 1 2 2>/dev/null || echo "mpstat unavailable"

echo "== host: socket summary (ss -s) =="
ss -s

echo "== host: k6 process resource usage =="
ps -o pid,pcpu,pmem,etime,cmd -C k6 2>/dev/null || echo "k6 not running"

echo "== host: ephemeral port usage =="
cat /proc/sys/net/ipv4/ip_local_port_range
ss -tan | awk '{print $1}' | sort | uniq -c

echo "== host: file descriptor limits (current shell) =="
ulimit -Sn
ulimit -Hn

echo "== host: network device counters =="
cat /proc/net/dev
EOF
sed -i.bak "s/LABEL_PLACEHOLDER/${LABEL}/" "${OUTPUT_FILE}" && rm -f "${OUTPUT_FILE}.bak"

echo "Saved load-generator snapshot (${LABEL}) to ${OUTPUT_FILE}"
