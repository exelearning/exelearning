#!/usr/bin/env bash
# Polls a cheap unrelated endpoint (default /healthcheck) at a fixed interval
# and logs latency for each call. Meant to run *alongside* a k6 scenario to
# answer a different question than k6's own metrics: does the server stay
# responsive to unrelated traffic while under load, or does the load block
# it entirely (e.g. an event-loop-blocking bug)? A healthy server keeps
# this probe fast even while a k6 scenario is saturating some other endpoint;
# a server whose event loop is blocked will show this probe stalling too.
#
# Usage:
#   test/load/scripts/probe-responsiveness.sh <output-file> <duration-s> [interval-s] [path]
#
# Environment variables:
#   BASE_URL      default: http://localhost:8080
#   HOST_HEADER   default: derived from BASE_URL's hostname
#
# Intended to run on the load-generator host (GNU coreutils/date), alongside
# the other k6 scripts. `date`'s %3N (milliseconds) is a GNU extension and
# will not work under macOS/BSD date.

set -euo pipefail

OUTPUT_FILE="$1"
DURATION_S="$2"
INTERVAL_S="${3:-0.2}"
PROBE_PATH="${4:-/healthcheck}"

BASE_URL="${BASE_URL:-http://localhost:8080}"
HOST_HEADER="${HOST_HEADER:-$(printf '%s' "${BASE_URL}" | sed -E 's#^https?://##; s#[:/].*##')}"

mkdir -p "$(dirname "${OUTPUT_FILE}")"
echo "timestamp_utc,http_code,time_total_s" >"${OUTPUT_FILE}"

end_ts=$(($(date +%s) + DURATION_S))
while [[ $(date +%s) -lt ${end_ts} ]]; do
    line=$(curl -s -o /dev/null -H "Host: ${HOST_HEADER}" -w "%{http_code},%{time_total}" "${BASE_URL}${PROBE_PATH}" || echo "000,-1")
    echo "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"),${line}" >>"${OUTPUT_FILE}"
    sleep "${INTERVAL_S}"
done

echo "Responsiveness probe done: ${OUTPUT_FILE}"
