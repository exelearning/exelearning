#!/usr/bin/env bash
# Runs one k6 scenario and stores its artifacts under a stable RUN_ID
# directory, together with the git commit and image digest under test so
# every result stays traceable per issue #2255's experiment discipline.
#
# Usage:
#   test/load/scripts/run.sh <scenario> <run-id> [-- -e KEY=VALUE ...]
#
# Example:
#   test/load/scripts/run.sh idle-websocket E2255-SINGLE-IDLE-0100-001 \
#       -- -e SMOKE_VUS=100 -e HOLD_DURATION_S=600
#
# Environment variables:
#   K6_BIN        path to the k6 binary (default: k6 on PATH)
#   IMAGE_DIGEST  optional, recorded in run-info.txt for traceability

set -euo pipefail

SCENARIO="$1"
shift
RUN_ID="$1"
shift
if [[ "${1:-}" == "--" ]]; then
    shift
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
K6_BIN="${K6_BIN:-k6}"

SCENARIO_FILE="${REPO_ROOT}/test/load/k6/${SCENARIO}.mjs"
if [[ ! -f "${SCENARIO_FILE}" ]]; then
    available=()
    for f in "${REPO_ROOT}"/test/load/k6/*.mjs; do
        available+=("$(basename "${f}" .mjs)")
    done
    echo "Unknown scenario '${SCENARIO}'. Available: ${available[*]}" >&2
    exit 1
fi

RESULTS_DIR="${REPO_ROOT}/test/load/results/${RUN_ID}"
mkdir -p "${RESULTS_DIR}"

{
    echo "run_id=${RUN_ID}"
    echo "scenario=${SCENARIO}"
    echo "started_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "git_commit=${GIT_COMMIT:-$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)}"
    echo "git_branch=${GIT_BRANCH:-$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"
    echo "image_digest=${IMAGE_DIGEST:-unknown}"
    echo "k6_version=$("${K6_BIN}" version)"
} >"${RESULTS_DIR}/run-info.txt"
cat "${RESULTS_DIR}/run-info.txt"

# k6's open() path resolution has changed across versions (relative to the
# entry script's directory today, relative to the calling module in the
# future). Pass an absolute default so scenario scripts never depend on
# either behavior; explicit -e BENCH_PROJECTS_FILE=... in "$@" still wins
# since it's appended after this default.
DEFAULT_PROJECTS_FILE="${REPO_ROOT}/test/load/data/projects.json"

set +e
"${K6_BIN}" run \
    --summary-export "${RESULTS_DIR}/summary.json" \
    --out "json=${RESULTS_DIR}/timeseries.ndjson" \
    -e "BENCH_PROJECTS_FILE=${BENCH_PROJECTS_FILE:-${DEFAULT_PROJECTS_FILE}}" \
    "$@" \
    "${SCENARIO_FILE}" 2>&1 | tee "${RESULTS_DIR}/k6.log"
k6_exit="${PIPESTATUS[0]}"
set -e

if command -v gzip >/dev/null 2>&1 && [[ -f "${RESULTS_DIR}/timeseries.ndjson" ]]; then
    gzip -f "${RESULTS_DIR}/timeseries.ndjson"
fi

echo "finished_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >>"${RESULTS_DIR}/run-info.txt"
echo "k6_exit_code=${k6_exit}" >>"${RESULTS_DIR}/run-info.txt"
echo "== Results stored in ${RESULTS_DIR} =="
exit "${k6_exit}"
