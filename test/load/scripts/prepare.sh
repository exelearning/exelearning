#!/usr/bin/env bash
# Seeds bench user accounts and projects on the target eXeLearning deployment
# so the k6 scenarios in test/load/k6 have real data to run against.
#
# Idempotent: re-running only tops up missing users/projects, it never
# deletes existing data. Safe to run from Bender or Zoidberg (anywhere with
# SSH access to Gordobot and HTTP access to the deployment under test).
#
# Usage:
#   test/load/scripts/prepare.sh [NUM_PROJECTS] [NUM_USERS]
#
# Environment variables (BASE_URL/HOST_HEADER/SUT_SSH/SUT_COMPOSE_DIR
# are required — they're specific to your own deployment, no personal default):
#   BASE_URL              e.g. http://sut-host:8080 (LAN-direct, bypasses any CDN/proxy)
#   HOST_HEADER           virtual host routed by your reverse proxy, e.g. bench.example.com
#   SUT_SSH          e.g. deploy@sut-host
#   SUT_COMPOSE_DIR  e.g. /home/deploy/exenew
#   SUT_COMPOSE_FILE default: docker-compose.yml
#   SUT_SERVICE      default: exenew
#   BENCH_USER_PREFIX     default: bench-user-
#   BENCH_USER_DOMAIN     default: exelearning.net
#   BENCH_PASSWORD        default: Bench1234!
#   PROJECTS_FILE         default: test/load/data/projects.json

set -euo pipefail

NUM_PROJECTS="${1:-20}"
NUM_USERS="${2:-2}"

: "${BASE_URL:?Set BASE_URL to the target deployment LAN-direct entry point, e.g. BASE_URL=http://sut-host:8080}"
: "${HOST_HEADER:?Set HOST_HEADER to the virtual host your reverse proxy routes, e.g. HOST_HEADER=bench.example.com}"
: "${SUT_SSH:?Set SUT_SSH to the system-under-test SSH target, e.g. SUT_SSH=deploy@sut-host}"
: "${SUT_COMPOSE_DIR:?Set SUT_COMPOSE_DIR to the deployment compose directory on that host}"
SUT_COMPOSE_FILE="${SUT_COMPOSE_FILE:-docker-compose.yml}"
SUT_SERVICE="${SUT_SERVICE:-exenew}"
BENCH_USER_PREFIX="${BENCH_USER_PREFIX:-bench-user-}"
BENCH_USER_DOMAIN="${BENCH_USER_DOMAIN:-exelearning.net}"
BENCH_PASSWORD="${BENCH_PASSWORD:-Bench1234!}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
PROJECTS_FILE="${PROJECTS_FILE:-${REPO_ROOT}/test/load/data/projects.json}"

echo "== Ensuring ${NUM_USERS} bench user account(s) exist on Gordobot =="
for ((i = 0; i < NUM_USERS; i++)); do
    email="${BENCH_USER_PREFIX}${i}@${BENCH_USER_DOMAIN}"
    echo "  - ${email}"
    ssh "${SUT_SSH}" \
        "docker compose -f '${SUT_COMPOSE_DIR}/${SUT_COMPOSE_FILE}' exec -T ${SUT_SERVICE} \
         bun run dist/cli.js create-user '${email}' '${BENCH_PASSWORD}' --no-fail"
done

login_token() {
    local email="$1"
    curl -sS -H "Host: ${HOST_HEADER}" -H "Content-Type: application/json" \
        -X POST -d "{\"email\":\"${email}\",\"password\":\"${BENCH_PASSWORD}\"}" \
        "${BASE_URL}/api/auth/login" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
}

create_project() {
    local token="$1"
    local title="$2"
    curl -sS -H "Host: ${HOST_HEADER}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" \
        -X POST -d "{\"title\":\"${title}\"}" \
        "${BASE_URL}/api/v1/projects" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["uuid"])'
}

existing_count=0
if [[ -f "${PROJECTS_FILE}" ]]; then
    existing_count="$(python3 -c 'import json; print(len(json.load(open("'"${PROJECTS_FILE}"'"))))' 2>/dev/null || echo 0)"
fi

echo "== Existing projects on file: ${existing_count} / target: ${NUM_PROJECTS} =="
if ((existing_count >= NUM_PROJECTS)); then
    echo "Nothing to do."
    exit 0
fi

mkdir -p "$(dirname "${PROJECTS_FILE}")"
if [[ ! -f "${PROJECTS_FILE}" ]]; then
    echo "[]" >"${PROJECTS_FILE}"
fi

# Log in once per owner and reuse the token for every project it creates,
# instead of re-authenticating per project — this used to dominate seeding
# time (and auth-endpoint load) once project counts reached the thousands.
declare -a owner_tokens
for ((u = 0; u < NUM_USERS; u++)); do
    owner_tokens[u]="$(login_token "${BENCH_USER_PREFIX}${u}@${BENCH_USER_DOMAIN}")"
done

to_create=$((NUM_PROJECTS - existing_count))
echo "== Creating ${to_create} project(s) =="
for ((i = 0; i < to_create; i++)); do
    idx=$((existing_count + i))
    user_index=$((idx % NUM_USERS))
    owner_email="${BENCH_USER_PREFIX}${user_index}@${BENCH_USER_DOMAIN}"
    uuid="$(create_project "${owner_tokens[user_index]}" "bench-project-${idx}")"
    echo "  - ${uuid} (owner: ${owner_email})"
    # Written directly to PROJECTS_FILE after every project (not a temp file
    # moved in at the end) so an interrupted run keeps whatever it already
    # created instead of losing it.
    python3 - "$PROJECTS_FILE" "$uuid" "$owner_email" <<'PY'
import json, sys
path, uuid, owner = sys.argv[1:4]
with open(path) as f:
    data = json.load(f)
data.append({"uuid": uuid, "ownerEmail": owner})
with open(path, "w") as f:
    json.dump(data, f, indent=2)
PY
done

echo "== Done. ${NUM_PROJECTS} project(s) available at ${PROJECTS_FILE} =="
