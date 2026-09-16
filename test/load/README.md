# Load testing (issue #2255 — C10k benchmark)

Reproducible k6-based load testing for eXeLearning Cloud, built to answer
[issue #2255](https://github.com/exelearning/exelearning/issues/2255): how many
concurrent users and long-lived WebSocket connections can one eXeLearning
instance, and a horizontally scaled HA deployment, sustain under realistic
workloads.

This tooling assumes the three-machine setup used for the benchmark:

| Role | Machine | Notes |
|---|---|---|
| Controller (source, orchestration, analysis) | Bender (macOS) | this repo |
| Load generator | Zoidberg (Ubuntu) | runs k6, must not become the bottleneck |
| System under test | Gordobot (Ubuntu) | runs the eXeLearning deployment under `/home/deploy/exenew` |

Adapt hostnames/IPs via environment variables if you run this elsewhere.

## Multi-generator mode (Zoidberg + Bender)

k6's classic executor pre-allocates one JS VM per virtual user, which gets memory-expensive at a few thousand VUs.
Zoidberg (an old 4-thread/7.2 GiB laptop) was observed at **71% RAM usage and heavy zram compression at just 2500
concurrent VUs** — a real risk of the load generator itself becoming the bottleneck the benchmark is trying to
measure on the server side. Above ~2000-2500 VUs, split the target across Zoidberg and Bender (also LAN-reachable
to Gordobot, and far more capable: 10-core Apple Silicon, 24 GiB RAM) instead of pushing Zoidberg alone.

Every scenario reads `VU_OFFSET` (`test/load/k6/lib/config.mjs`, `globalVuIndex()`) and adds it to the local
`__VU` before indexing into the account/project pool — since k6's `__VU` restarts at 1 in every separate process,
this is what keeps two machines from both hammering the same accounts/projects. To split a 5000-VU idle-WebSocket
run as (Zoidberg: 1500, Bender: 3500):

```bash
# On Zoidberg:
bash test/load/scripts/run.sh idle-websocket E2255-SINGLE-IDLE-5000-001-zoidberg -- \
    -e TARGET_VUS=1500 -e VU_OFFSET=0 -e RAMP_UP_S=200 -e HOLD_DURATION_S=600

# On Bender, at the same time (install a k6 binary matching Zoidberg's exact version first — see below):
bash test/load/scripts/run.sh idle-websocket E2255-SINGLE-IDLE-5000-001-bender -- \
    -e TARGET_VUS=3500 -e VU_OFFSET=1500 -e RAMP_UP_S=200 -e HOLD_DURATION_S=600
```

`prepare.sh` must have seeded at least `VU_OFFSET + TARGET_VUS` projects so neither machine's index range runs out.
Combine the two `summary.json` files when reporting (sum counters, keep the worse of the two latency
distributions) — the report should state the split used for reproducibility.

**Use the same k6 version on every generator.** Zoidberg installed k6 as a static binary at `~/bin/k6`
(no root required). To match it exactly on Bender rather than pulling whatever Homebrew currently packages:

```bash
curl -fsSL -o /tmp/k6.zip https://github.com/grafana/k6/releases/download/v0.55.0/k6-v0.55.0-macos-arm64.zip
unzip -o /tmp/k6.zip -d /tmp/k6-extracted
mv /tmp/k6-extracted/k6-v0.55.0-macos-arm64/k6 ~/bin/k6 && chmod +x ~/bin/k6
```

## Methodology notes (read before running)

- **Bypass Cloudflare/WAN.** The test deployment is also reachable at
  `https://bench.example.com/`, which resolves to Cloudflare and adds
  uncontrolled internet latency/limits that have nothing to do with the
  server under test. All scripts instead talk to Gordobot's Traefik
  **directly over the LAN** (`http://sut-host:8080`) with an explicit
  `Host: bench.example.com` header, which Traefik uses for routing.
  This works for both plain HTTP and the WebSocket upgrade request. Do not
  point load tests at the public domain.
- **Many projects, few collaborators.** Per the issue, the primary
  scalability model is many independent projects with 1-10 collaborators
  each — not thousands of users in one Yjs room (that is tested separately,
  see `k6/collaboration.mjs`). Test data is pre-created projects, not
  thousands of distinct user accounts: the Yjs WebSocket relay scales by
  project ("room"), and JWT auth does not limit concurrent connections per
  account, so a small pool of accounts owning many projects is a faithful
  and much simpler way to generate the target concurrency.
- **The relay is content-agnostic.** `src/websocket/message-parser.ts`
  forwards any binary WebSocket frame that isn't a JSON asset-coordination
  message as an opaque Yjs update — the server never decodes it. Load
  scripts therefore send randomly-filled binary frames shaped like real Yjs
  traffic (see `k6/lib/ws.mjs`) instead of depending on the real `yjs` /
  `y-protocols` JS libraries, which keeps k6 scripts dependency-free.
- **One variable at a time.** Change Nginx settings, or add an instance, or
  switch load-balancing strategy — then repeat the same scenario and
  compare. Do not combine changes in the same comparison.

## Prerequisites

- **Zoidberg**: k6 (installed as a static binary at `~/bin/k6`, no root
  required), `curl`, `python3` (already present). `iperf3`/`sysstat` were
  installed via `apt` for one-off network/CPU sanity checks.
- **Gordobot**: Docker + Docker Compose (already present), the `exenew`
  deployment under `/home/deploy/exenew`.
- **Bender**: `ssh` access to both machines, `rsync` (or `scp`) to push this
  directory to Zoidberg before each run, since k6 reads scripts from local
  disk.

Sync the tooling to the load generator whenever scripts change:

```bash
rsync -a --delete test/load/ deploy@load-gen-host:~/exelearning-load/test/load/
```

## Directory layout

```text
test/load/
  README.md
  k6/
    lib/
      config.mjs      # env-driven configuration, shared across scenarios
      auth.mjs         # login helper + account pool selection
      projects.mjs     # loads the pre-seeded project pool
      ws.mjs           # WebSocket URL builder + synthetic Yjs-shaped payloads
    smoke.mjs           # ~10 users, one iteration each — run this first
    idle-websocket.mjs  # phase 2: idle WebSocket connection capacity
    normal-editing.mjs  # phase 3: realistic editing workload
    collaboration.mjs   # phase 4: single-project collaboration fan-out
    api.mjs              # pure HTTP baseline, no WebSocket
    login-burst.mjs      # isolated POST /api/auth/login concurrency test
  scripts/
    prepare.sh            # seed bench users + projects (idempotent)
    run.sh                # run one scenario, store artifacts under a RUN_ID
    collect-sut.sh        # snapshot SUT host/Docker/Redis/PostgreSQL metrics
    collect-generator.sh  # snapshot load-generator host metrics
    reset-environment.sh  # guarded `docker compose down -v && up -d`
  data/        # gitignored: projects.json produced by prepare.sh
  results/     # gitignored: raw k6 output per RUN_ID, kept locally
```

## Environment variables

All scripts and k6 scenarios read configuration from environment variables
so the same code runs against any topology. The most common ones:

| Variable | Default | Meaning |
|---|---|---|
| `BASE_URL` | `http://sut-host:8080` | LAN-direct entry point (Traefik on Gordobot) |
| `HOST_HEADER` | `bench.example.com` | Virtual host routed by Traefik |
| `WS_BASE_URL` | derived from `BASE_URL` | Override if the WS entry point differs (e.g. through the Nginx LB in HA mode) |
| `BENCH_USER_COUNT` | `2` | Size of the login account pool |
| `BENCH_PASSWORD` | `Bench1234!` | Password for bench accounts created by `prepare.sh` |
| `BENCH_PROJECTS_FILE` | `test/load/data/projects.json` | Project pool (auto-set to an absolute path by `run.sh`) |
| `TARGET_VUS` | scenario-specific | Concurrency target |
| `USERS_PER_PROJECT` | `1` | Collaborators sharing one project (normal-editing.mjs) |
| `COLLABORATORS` / `PROJECT_COUNT` | `10` / `1` | collaboration.mjs sizing |
| `HOLD_DURATION_S` | `600` | How long connections stay open (10 min default, per issue) |
| `RAMP_UP_S` / `RAMP_DOWN_S` | `60` / `30` | Ramp timing |

## Running a benchmark

### 1. Seed test data (once per environment, idempotent)

```bash
./test/load/scripts/prepare.sh 200 2   # 200 projects, 2 owner accounts
```

Run this from Bender or Zoidberg (anywhere with SSH access to Gordobot and
HTTP access to the deployment). Re-run with a larger project count later to
top up without recreating existing projects.

### 2. Smoke test (always run this first)

```bash
ssh deploy@load-gen-host '
  cd ~/exelearning-load &&
  K6_BIN=~/bin/k6 BASE_URL=http://sut-host:8080 HOST_HEADER=bench.example.com \
  GIT_COMMIT='"$(git rev-parse HEAD)"' GIT_BRANCH='"$(git rev-parse --abbrev-ref HEAD)"' \
  bash test/load/scripts/run.sh smoke E2255-SMOKE-001 -- -e SMOKE_VUS=10
'
```

Do not proceed to higher concurrency until this passes with 0 login/WS
failures.

### 3. Idle WebSocket capacity progression

Run with increasing `TARGET_VUS` (100, 500, 1000, 2500, 5000, 10000 — per
the issue's suggested progression), holding each for ~10 minutes once the
scripts are validated:

```bash
bash test/load/scripts/run.sh idle-websocket E2255-SINGLE-IDLE-0100-001 -- \
    -e TARGET_VUS=100 -e HOLD_DURATION_S=600
```

### 4. Realistic editing workload

```bash
bash test/load/scripts/run.sh normal-editing E2255-SINGLE-NORMAL-0040-U04-001 -- \
    -e TARGET_VUS=40 -e USERS_PER_PROJECT=4 -e HOLD_DURATION_S=600
```

### 5. Collaboration fan-out

```bash
bash test/load/scripts/run.sh collaboration E2255-COLLAB-0050-001 -- \
    -e COLLABORATORS=50 -e PROJECT_COUNT=1 -e HOLD_DURATION_S=300
```

### 6. Pure API baseline

```bash
bash test/load/scripts/run.sh api E2255-API-0050-001 -- -e TARGET_VUS=50
```

### 7. Isolated login-burst test

Use this to measure the auth endpoint's own concurrency ceiling — e.g. to
compare before/after a change to password verification — without WebSocket
traffic mixed in:

```bash
bash test/load/scripts/run.sh login-burst E2255-LOGIN-0500-001 -- -e TARGET_VUS=500
```

All commands above are run **on Zoidberg** (`ssh deploy@load-gen-host` then
`cd ~/exelearning-load`), after syncing this directory there. `run.sh`
stores `run-info.txt` (git commit/branch, k6 version, timestamps),
`summary.json` (k6's end-of-test summary), `k6.log` (full console output),
and `timeseries.ndjson.gz` (per-request/per-check time series) under
`test/load/results/<RUN_ID>/`.

## Collecting host/service metrics alongside a run

Take a snapshot before and after (or periodically during) a run:

```bash
./test/load/scripts/collect-sut.sh test/load/results/<RUN_ID>/sut-before.txt before
./test/load/scripts/collect-sut.sh test/load/results/<RUN_ID>/sut-after.txt after
./test/load/scripts/collect-generator.sh test/load/results/<RUN_ID>/generator-before.txt before
./test/load/scripts/collect-generator.sh test/load/results/<RUN_ID>/generator-after.txt after
```

For longer runs, loop these on an interval (e.g. every 60s) in a separate
terminal for the duration of the k6 run.

## Resetting the environment

Only reset when you genuinely need a clean slate (e.g. switching topology).
This destroys all test data:

```bash
./test/load/scripts/reset-environment.sh --yes "switching from single-instance to HA topology"
./test/load/scripts/prepare.sh 200 2
```

Every reset is appended to `test/load/results/reset-log.txt`.

## Testing single-instance vs. HA

- **Single instance**: use Gordobot's existing `/home/deploy/exenew/docker-compose.yml`
  as-is (one `exenew` service + MariaDB). This is the phase-1 baseline.
- **HA**: adapt `doc/deploy/docker-compose.redis.yml` + `doc/deploy/nginx-ha.conf`
  (the project's documented HA reference architecture) for the `exenew`
  image tag, deployed alongside/instead of the single-instance stack on
  Gordobot. Point `BASE_URL`/`HOST_HEADER` at the Nginx LB entry point
  instead of Traefik directly. See the final benchmark report for the exact
  compose/Nginx diffs used and why (`ip_hash` vs `least_conn` comparison,
  file-descriptor/`worker_connections` tuning).

## Interpreting results

A run is only a **pass** if it meets the issue's success criteria: target
concurrency held for the full duration, WebSocket failure rate < 1%,
HTTP/API error rate < 1%, no unbounded memory growth, no FD exhaustion, no
sustained CPU saturation, and stable Redis/PostgreSQL. See the final
benchmark report (English and Spanish) for the full results table, observed
bottlenecks, and capacity recommendations.
