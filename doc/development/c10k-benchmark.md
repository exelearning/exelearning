# C10k-class concurrency benchmark

Report for [issue #2255](https://github.com/exelearning/exelearning/issues/2255): how many concurrent users and
long-lived WebSocket connections a single eXeLearning instance, and a horizontally scaled HA deployment, can
sustain under realistic workloads. Benchmark tooling lives under [`test/load/`](../../test/load/README.md); see
that directory's README for exact reproduction commands.

*(Draft — being written alongside an in-progress benchmark run. Sections not yet backed by a completed test are
marked accordingly.)*

## Objective

The [C10k problem](https://en.wikipedia.org/wiki/C10k_problem) is used as an architectural reference, not a pass/fail
target. The goal is to measure — not assume — how many concurrent users one instance and a horizontally scaled
deployment can serve under a realistic eXeLearning usage pattern (many independent projects, 1-10 collaborators
each), and to identify the first component that limits that capacity.

## Methodology

- **Three dedicated machines**: Bender (macOS, controller: source, Docker builds, orchestration, analysis),
  Zoidberg (Ubuntu, load generator: k6), Gordobot (Ubuntu, system under test: the `exenew` Docker deployment).
- **LAN-direct, not the public domain.** The test deployment is also reachable at
  `https://exenew.miquistiquis.com/`, which resolves to Cloudflare and would add uncontrolled WAN/CDN latency and
  limits that have nothing to do with the server under test. All load is instead sent directly to Gordobot's
  Traefik over the LAN (`http://192.168.4.5:8080`) with an explicit `Host: exenew.miquistiquis.com` header, which
  Traefik uses for routing. Verified to work for both plain HTTP and the WebSocket upgrade request.
- **One variable at a time.** Every comparison changes exactly one thing (an image build, an Nginx config, an
  instance count) and repeats the same scenario before drawing a conclusion.
- **Content-agnostic Yjs relay.** `src/websocket/message-parser.ts` forwards any binary WebSocket frame that isn't
  a JSON asset-coordination message as an opaque Yjs update — the server never decodes it for routing. Load
  scripts send randomly-filled, realistically-sized binary frames instead of depending on the real `yjs` /
  `y-protocols` JS libraries (see `test/load/k6/lib/ws.mjs`).
- **Scalability model**: many independent projects with 1-10 collaborators each (per the issue), not thousands of
  users in one Yjs room — that is measured separately as "collaboration fan-out".

## Hardware and software

| Machine | Role | CPU | RAM | NIC | OS / kernel |
|---|---|---|---|---|---|
| Bender | Controller | Apple Silicon (macOS) | — | — | macOS (Darwin 25.4.0) |
| Zoidberg | Load generator | Intel Core i7-4650U, 4 threads | 7.2 GiB | Wi-Fi only (`wlp3s0`), no Ethernet | Ubuntu 25.10, kernel 6.17 |
| Gordobot | System under test | Intel Core i5-8250U, 8 threads | 31 GiB | Gigabit Ethernet (`enp58s0f1`) | Ubuntu 24.04.4 LTS, kernel 6.8 |

Both Zoidberg and Gordobot are repurposed laptops, not server-class hardware — capacity numbers below must be read
against this ceiling, not extrapolated to production server hardware without re-measuring.

**Important caveat: Gordobot is not a dedicated benchmark host.** At the time of testing it was concurrently
running ~29 unrelated Docker containers for other projects (n8n, Moodle, Odoo, Keycloak, HedgeDoc, other
eXeLearning builds, etc.), with a baseline host load average around 1.6-2.9 on 8 threads even at rest. This is a
real confound: absolute latency/CPU numbers include noise from unrelated workloads, and are not directly comparable
to a clean dedicated host. Where a finding depends on isolating this noise, it is called out explicitly.

Zoidberg's load-generating NIC is Wi-Fi only. A raw `iperf3` throughput check (Zoidberg → Gordobot, 8s, TCP) measured
**~130 Mbps sustained, 0 retransmits** — well under Gordobot's 1 Gbps Ethernet, and a ceiling to watch for
bandwidth-heavy scenarios, though not a factor for connection-count/message-rate-bound WebSocket tests at the
scale tested so far.

| Software | Version |
|---|---|
| k6 (load generator) | v0.55.0 (static binary, no root required) |
| Docker (Gordobot) | 27.4.1 |
| Docker Compose (Gordobot) | v2.32.1 |
| eXeLearning image | `ghcr.io/exelearning/exelearning:exenew` |

## Topology

Single-instance baseline: Gordobot's existing `/home/ernesto/exenew` deployment — one `exenew` container, MariaDB,
fronted by Traefik (reached LAN-direct, bypassing Cloudflare as above). `APP_ENV=dev` (the deployment's existing
setting; see [Modifications tested](#modifications-tested) for why this was not changed for the WebSocket-capacity
runs).

HA topology (Redis + PostgreSQL + N instances + Nginx) is defined in [`test/load/deploy/`](../../test/load/deploy/)
and adapts [`doc/deploy/docker-compose.redis.yml`](../deploy/docker-compose.redis.yml); results below under
[HA results](#ha-results) once that phase runs.

## Benchmark implementation

k6 scenarios and orchestration scripts: [`test/load/`](../../test/load/README.md).

- `smoke.mjs` — ~10 users, one iteration each, validates auth/WS/scripts before any real concurrency.
- `login-burst.mjs` — isolated `POST /api/auth/login` concurrency test, no WebSocket.
- `idle-websocket.mjs` — ramps to N concurrent mostly-idle WebSocket connections, holds, measures capacity.
- `normal-editing.mjs` — realistic per-project session: WS updates + metadata polls + autosave, randomized timing.
- `collaboration.mjs` — concentrates many collaborators on few projects, measures message fan-out.
- `api.mjs` — pure HTTP baseline, no WebSocket, for comparison.

Every run is identified by a stable RUN ID (`E2255-<SCENARIO>-<PARAMS>-<seq>`) and records the exact git commit,
image digest, and k6 version alongside its results (`test/load/scripts/run.sh`).

## Identified bottlenecks

### 1. `bcryptjs.compare()` blocked the event loop under concurrent logins (fixed)

**Observation.** During the single-instance idle-WebSocket progression, a 500-VU run with a short (60s) ramp
produced widespread `POST /api/auth/login: request timeout` errors partway through — before any WebSocket capacity
limit was reached.

**Evidence.** Both login routes (`src/routes/auth.ts`) called `bcrypt.compare()` from the pure-JS `bcryptjs`
package directly, instead of the shared `verifyPassword()` service in `src/services/password.ts` — which already
used Bun's native `Bun.password.hash()` for hashing, but (before this fix) `bcryptjs.compare()` for verification.
`bcryptjs` computes bcrypt in pure JavaScript; under concurrent load this serializes on Bun's single JS thread.

**Hypothesis.** Concurrent password verification was blocking Bun's single-threaded event loop entirely — not just
delaying other logins, but delaying *all* request handling, including unrelated endpoints.

**Experiment.** Two images built from the same commit range, differing only in `verifyPassword()`'s implementation
(`bcryptjs.compare` vs `Bun.password.verify`, commit `19ae39ed8`). For each, ran `login-burst.mjs` at 500
concurrent VUs (`shared-iterations`, one login per VU) while a separate probe polled the unrelated `/healthcheck`
endpoint every 200ms throughout.

**Result:**

| | Before (`bcryptjs.compare`) | After (`Bun.password.verify`) |
|---|---|---|
| Login success rate | 36% (180/500) | **100% (500/500)** |
| Login failures | 320 timeouts (60s) | 0 |
| Login latency (avg / p95) | 50.85s / 59.99s | 12.99s / 21.28s |
| `/healthcheck` probe samples completed in 40s | 7 (most calls stalled) | 143 (full rate) |
| `/healthcheck` probe latency (p50 / p95 / max) | 8ms / 2.8s / **138.3s** | 11.6ms / 58ms / 117ms |

**Conclusion.** Confirmed, not just plausible: the pure-JS bcrypt comparison was blocking the entire event loop —
an unrelated, trivially cheap endpoint stalled for up to 138 seconds during the same burst that broke logins.
Switching to `Bun.password.verify()` (which reads the algorithm from the hash, so it verifies `bcryptjs`-produced
hashes too — no data migration needed) eliminates the failures and the collateral blocking entirely. Residual
elevated latency at 500 *simultaneous* logins (avg ~13s) reflects genuine bcrypt CPU cost on this shared,
contended 8-thread host, not a code defect — see [Limitations](#limitations). In the normal-editing/idle-websocket
scenarios, where logins are naturally spread out over a ramp-up window rather than arriving as one instant burst,
observed login latency stayed in the 250-350ms range even at 2500 VUs (see below).

Fix: commit `19ae39ed8` on branch `2255-c10k-load-testing`.

## Single-instance results

Deployment: Gordobot, `/home/ernesto/exenew` (single `exenew` instance + MariaDB), `APP_ENV=dev`, image digest
`sha256:489cdc8d177f69584971d3aa11728f0a9536e1b21df995183977d749d32157dd` (includes the login fix above).

| RUN ID | Users | Projects | Ramp | Hold | WS success | Login avg/p95 | SUT CPU | SUT RAM | Result |
|---|---|---|---|---|---|---|---|---|---|
| E2255-SMOKE-002 | 10 | 10 | 5s | — | 100% | ~1.4s / — | negligible | ~250 MiB | PASS |
| E2255-SINGLE-IDLE-0100-001 | 100 | 100 | 20s | 120s | 99%¹ | 7.6s / 13.1s² | 1.2% | 248 MiB | PASS (see note) |
| E2255-SINGLE-IDLE-0500-002 | 500 | 500 | 100s | 180s | **100%** | 256ms / 275ms | 1.1% | 234 MiB | PASS |
| E2255-SINGLE-IDLE-1000-001 | 1000 | 1000 | 120s | 180s | **100%** | 272ms / 310ms | 1.2% | 247 MiB | PASS |
| E2255-SINGLE-IDLE-2500-001 | 2500 | 2500 | 250s | 600s | *(running)* | | | | *(pending)* |

¹ One VU's login/WS iteration did not start at all — traced to a `ramping-vus` scheduling edge case (the very last
VU scheduled right at the end of a single-stage ramp can be dropped), not a server-side failure; fixed for later
runs by adding a short plateau stage (see `test/load/k6/idle-websocket.mjs`).
² This run used a 20s ramp for 100 logins (~5/s) and pre-dates the login-verification fix — elevated but not yet
catastrophic; motivated the dedicated login-burst investigation above.

*(2500/5000/10000 tiers, HA results, collaboration fan-out, and browser validation to follow as they complete.)*

## HA results

*(Pending — single-instance baseline not yet fully established.)*

## Collaboration fan-out results

*(Pending.)*

## Browser validation

*(Pending.)*

## Modifications tested

- **`APP_ENV=dev` vs `prod`**: not yet run as an isolated comparison. Per code inspection (`src/index.ts`), the only
  effect of `APP_ENV` itself is whether `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are auto-seeded as a real user on
  startup; published images always ship prebuilt bundles regardless of `APP_ENV`. `APP_DEBUG` (a separate variable,
  currently `1` on the tested deployment) controls debug logging verbosity and was not yet isolated either. Both
  are candidates for a dedicated one-variable comparison before the final report.
- **`bcryptjs.compare` vs `Bun.password.verify`**: see [Identified bottlenecks](#identified-bottlenecks) above.

## Limitations

- Gordobot hosts ~29 unrelated containers for other projects; absolute CPU/latency figures include contention from
  that unrelated load and are not representative of a dedicated host. Relative comparisons (before/after a single
  changed variable) remain valid since the unrelated load was constant across each pair of runs.
- Both benchmark machines are consumer laptops (2013-2017 era), not server hardware; the capacity ceilings measured
  here are specific to this hardware and should not be read as eXeLearning's absolute limit.
- Zoidberg's load-generating NIC is Wi-Fi (measured ~130 Mbps), a ceiling to watch for bandwidth-heavy scenarios.
- The 500-VU login-burst "before" comparison used a separately tagged image
  (`ghcr.io/exelearning/exelearning:exenew-before-authfix`, digest `sha256:2897af5996f92dcd183b76e27c6db5573c338e88ab63456af2ae013145dc2f04`)
  built from commit `0bc68d55e` (the commit immediately before the fix on this same branch) — not a different
  branch — to isolate exactly the one changed line.

## Reproducibility

See [`test/load/README.md`](../../test/load/README.md) for exact prerequisites, environment variables, and
commands to reproduce every run above, including RUN IDs.

## Capacity recommendations

*(Pending final single-instance and HA numbers.)*

## Conclusions

*(Pending.)*
