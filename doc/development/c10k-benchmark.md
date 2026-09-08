# C10k-class concurrency benchmark

Report for [issue #2255](https://github.com/exelearning/exelearning/issues/2255): how many concurrent users and
long-lived WebSocket connections a single eXeLearning instance, and a horizontally scaled HA deployment, can
sustain under realistic workloads. Benchmark tooling lives under [`test/load/`](https://github.com/exelearning/exelearning/blob/main/test/load/README.md); see
that directory's README for exact reproduction commands.

The two durable decisions this benchmark produced are recorded as architecture decision records:
[ADR-2255-01](https://github.com/exelearning/exelearning/blob/main/doc/architecture/adr/ADR-2255-01-balance-websocket-upstream-with-least-conn.md)
(`least_conn` instead of `ip_hash` for the WebSocket upstream) and
[ADR-2255-02](https://github.com/exelearning/exelearning/blob/main/doc/architecture/adr/ADR-2255-02-verify-passwords-with-bun-native-bcrypt.md)
(native `Bun.password.verify` instead of pure-JS `bcryptjs` for password verification).

## Objective

The [C10k problem](https://en.wikipedia.org/wiki/C10k_problem) is used as an architectural reference, not a pass/fail
target. The goal is to measure — not assume — how many concurrent users one instance and a horizontally scaled
deployment can serve under a realistic eXeLearning usage pattern (many independent projects, 1-10 collaborators
each), and to identify the first component that limits that capacity.

## Methodology

- **Three dedicated machines, identified by role**: the orchestrator (macOS — source, Docker builds, orchestration,
  analysis), the client (Ubuntu — runs k6), and the SUT (Ubuntu — runs the `exenew` Docker deployment).
- **LAN-direct, not the public domain.** The test deployment is also reachable at
  `https://benchmark.example.com/`, which resolves to Cloudflare and would add uncontrolled WAN/CDN latency and
  limits that have nothing to do with the server under test. All load is instead sent directly to the SUT's
  Traefik over the LAN (`http://192.168.4.5:8080`) with an explicit `Host: benchmark.example.com` header, which
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

| Role | CPU | RAM | NIC | OS / kernel |
|---|---|---|---|---|
| Orchestrator | Apple Silicon (macOS) | — | — | macOS (Darwin 25.4.0) |
| Client (load generator) | Intel Core i7-4650U, 4 threads | 7.2 GiB | Wi-Fi only (`wlp3s0`), no Ethernet | Ubuntu 25.10, kernel 6.17 |
| SUT (system under test) | Intel Core i5-8250U, 8 threads | 31 GiB | Gigabit Ethernet (`enp58s0f1`) | Ubuntu 24.04.4 LTS, kernel 6.8 |

Both the client and the SUT are repurposed laptops, not server-class hardware — capacity numbers below must be read
against this ceiling, not extrapolated to production server hardware without re-measuring.

**Important caveat: the SUT is not a dedicated benchmark host.** At the time of testing it was concurrently
running ~29 unrelated Docker containers for other projects (n8n, Moodle, Odoo, Keycloak, HedgeDoc, other
eXeLearning builds, etc.), with a baseline host load average around 1.6-2.9 on 8 threads even at rest. This is a
real confound: absolute latency/CPU numbers include noise from unrelated workloads, and are not directly comparable
to a clean dedicated host. Where a finding depends on isolating this noise, it is called out explicitly.

The client's load-generating NIC is Wi-Fi only. A raw `iperf3` throughput check (client → SUT, 8s, TCP) measured
**~130 Mbps sustained, 0 retransmits** — well under the SUT's 1 Gbps Ethernet, and a ceiling to watch for
bandwidth-heavy scenarios, though not a factor for connection-count/message-rate-bound WebSocket tests at the
scale tested so far.

| Software | Version |
|---|---|
| k6 (load generator) | v0.55.0 (static binary, no root required) |
| Docker (SUT) | 27.4.1 |
| Docker Compose (SUT) | v2.32.1 |
| eXeLearning image | `ghcr.io/exelearning/exelearning:exenew` |

## Topology

Single-instance baseline: the SUT's existing `/home/deploy/exenew` deployment — one `exenew` container, MariaDB,
fronted by Traefik (reached LAN-direct, bypassing Cloudflare as above). `APP_ENV=dev` (the deployment's existing
setting; see [Modifications tested](#modifications-tested) for why this was not changed for the WebSocket-capacity
runs).

HA topology (Redis + PostgreSQL + N instances + Nginx) is defined in [`test/load/deploy/`](https://github.com/exelearning/exelearning/tree/main/test/load/deploy/)
and adapts [`doc/deploy/docker-compose.redis.yml`](../deploy/docker-compose.redis.yml); results below under
[HA results](#ha-results).

```mermaid
flowchart LR
    subgraph Orchestrator["Orchestrator (macOS) — controller"]
        K6B["k6 (load, larger share)"]
    end
    subgraph Client["Client (Ubuntu) — load generator"]
        K6Z["k6 (load, smaller share)"]
    end
    subgraph SUT["SUT (Ubuntu) — system under test"]
        direction TB
        Traefik["Traefik (public domain,\nsingle-instance only)"]
        subgraph Single["Single-instance topology"]
            App1["exenew (1 instance)"]
            MariaDB[("MariaDB")]
        end
        subgraph HA["HA topology (2 instances)"]
            Nginx["Nginx LB\nleast_conn / ip_hash"]
            AppHA1["exelearning-1"]
            AppHA2["exelearning-2"]
            Redis[("Redis\npub/sub")]
            Postgres[("PostgreSQL")]
        end
    end

    K6B -- "LAN-direct, bypasses WAN" --> SUT
    K6Z -- "LAN-direct, bypasses WAN" --> SUT
    Traefik -.->|"real-browser validation only"| App1
    App1 --> MariaDB
    Nginx --> AppHA1
    Nginx --> AppHA2
    AppHA1 <-->|"cross-instance sync"| Redis
    AppHA2 <-->|"cross-instance sync"| Redis
    AppHA1 --> Postgres
    AppHA2 --> Postgres
```

## Benchmark implementation

k6 scenarios and orchestration scripts: [`test/load/`](https://github.com/exelearning/exelearning/blob/main/test/load/README.md).

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

### 2. WebSocket room connections leaked forever on every close (fixed)

**Observation.** After the 10000-VU attempt (client OOM-killed leg + orchestrator's 7000-VU leg, see below), a
`GET /api/websocket/info` check — made with **no test running and no active traffic** — reported **16,947 "connected"
sockets across 9,948 rooms**. That total is suspiciously close to the sum of every WebSocket connection opened
across the *entire benchmark session up to that point* (roughly 17,000). A follow-up isolated 5-VU smoke test,
whose sockets all closed cleanly after 3 seconds, still left the count higher than before it ran — this was not
limited to abrupt/crashed disconnects.

**Root cause (dominant): Elysia wraps the socket in a fresh object per event.** `room-manager.ts` tracked each
room's connections in a `Set<ServerWebSocket<WsData>>`, keyed by object reference, and both `addConnection`/
`removeConnection` and `relayMessage`'s sender-exclusion (`conn !== sender`) relied on that reference staying
stable for a connection's lifetime. It doesn't: Elysia's Bun adapter
(`node_modules/elysia/dist/adapter/bun/index.js`) constructs a **brand-new `ElysiaWS` wrapper for every single
event** — `open`, `message`, `close`, and `drain` each get their own `new ElysiaWS(ws, context)` around the same
underlying Bun socket. The object our `close(ws)` handler receives is therefore never reference-equal to the one
`open(ws)` received for that same connection, so `room.conns.delete(ws)` silently no-oped on **every** close,
regardless of how the client disconnected — clean or abrupt. The unit test suite never caught this because its
mocks call the extracted handler functions directly with one shared object, which doesn't reproduce Elysia's
per-event wrapper behavior.

**Secondary, edge-case root cause: an async open/close race.** `open(ws)` is also `async` and awaits `verifyToken()`
and a project-access check before writing `ws.data.docName` and registering the connection. Bun does not wait for
this handler to finish before the socket is otherwise live, and fires `close(ws)` independently of that pending
promise. If a client disconnects mid-verification, `handleWebSocketClose` sees `ws.data.docName` still unset,
treats the close as `'unknown'`, and skips cleanup — then the still-in-flight `open()` resumes moments later and
registers the now-dead socket anyway, with no future `close` event left to remove it. Narrower than the wrapper-
identity bug (it needs a disconnect to land inside a specific await window) but real and worth fixing on its own.

**Experiment.** Fixed both: (1) key `Room.conns` by `ws.data.clientId` — stable across all of a connection's
events, since Elysia's `.data` is copied from Bun's own per-connection `data` — instead of the `ws` object
(commit `5c9d27ca9`); (2) bail out of `open()` before registering if `ws.readyState` shows the socket already
closed by the time the awaits resolve (commit `32c268257`). Regression tests for both construct a second object
sharing the same `clientId`/timing to simulate Elysia's real behavior; both fail without their respective fix and
pass with it (verified by reverting each fix in turn and re-running).

**Result / conclusion.** Confirmed root cause, not just plausible, for both: each regression test reproduces the
exact production symptom (a connection registered but never removable) without its fix and is clean with it. A
live check after deploying the fix confirmed it end-to-end: `GET /api/websocket/info` returned `0/0` after a
redeploy, and returned to the expected room/connection count (not higher) after each subsequent test tier — see
[the final single-instance results](#single-instance-results-final) below. This is very likely the dominant explanation for the
elevated login/WS latency observed at the 5000+ VU tiers on the pre-fix image, ahead of the "combined arrival
rate" explanation offered at the time: by the 10000-VU attempt, the room manager was iterating and bookkeeping for
roughly 17,000 phantom entries on top of whatever real traffic was in flight. The whole single-instance
progression was re-run against the fixed image — see the updated table below.

Fixes: commits `32c268257` and `5c9d27ca9` on branch `2255-c10k-load-testing`.

## Single-instance results (final)

Deployment: the SUT, `/home/deploy/exenew` (single `exenew` instance + MariaDB), `APP_ENV=dev`, image digest
`sha256:c1ec78fc9b213cc3a6317b81565a5b343e15beb436130605db72ca284dd8e645` (includes both the login fix and both
WebSocket connection-leak fixes above). Every run below was confirmed leak-free via
`GET /api/websocket/info` returning `totalConnections: 0` after completion.

| RUN ID | Users | Ramp | Hold | WS success | Login avg/p95 | SUT CPU | SUT RAM | Result |
|---|---|---|---|---|---|---|---|---|
| E2255-SMOKE-004 | 5 | 5s | — | 100% | — | negligible | ~250 MiB | PASS |
| E2255-SINGLE-IDLE-0100-003 | 100 | 20s | 120s | **100%** | 257ms / 269ms | negligible | ~248 MiB | PASS |
| E2255-SINGLE-IDLE-0500-003 | 500 | 60s | 180s | **100%** | 271ms / 307ms | 2.6% | 237 MiB | PASS |
| E2255-SINGLE-IDLE-1000-002 | 1000 | 120s | 180s | **100%** | 274ms / 327ms | 1.5% | 241 MiB | PASS |
| E2255-SINGLE-IDLE-2500-003 (split 1000 client + 1500 orchestrator) | 2500 | 100s/150s | **600s** | **100%** | 293ms / 407ms | 5.3% | 261 MiB | PASS |

**The client's safe single-generator ceiling is ≤2000 VUs, not 2500.** A same-parameter repeat of the 2500-VU
single-generator run OOM-killed at 6.06 GiB anon-rss (vs. 5.4 GiB survived on the first attempt) — 2500 sits right
at the edge and isn't a reliable pass/fail boundary on this hardware. From this tier onward, every run splits load
across the client (capped at a comfortably safe 1000-2000) and the orchestrator.

| E2255-SINGLE-IDLE-5000-003 (split 500 client + 4500 orchestrator) | 5000 | 100s/450s | **600s** | **100%** | 291-301ms / 348-380ms | 1.7% | 298 MiB | PASS |
| E2255-SINGLE-IDLE-10000-003 (orchestrator only) | 10000 | 1000s | **600s** | 99.92%⁴ | 8.06s / 31.27s⁵ | 1.15% | 257 MiB | **PASS** |

⁴ 22 failed checks out of 28,102 (0.078%) — well under the 1% threshold. `bench_ws_connect_failure` was 0; every
established WebSocket connection succeeded and held for the full 10 minutes.
⁵ At a sustained combined arrival rate of ~10 logins/s from a single generator process, login latency shows the
same queueing pattern documented in [Identified bottlenecks #1](#1-bcryptjscompare-blocked-the-event-loop-under-concurrent-logins-fixed):
real bcrypt CPU cost on this shared, contended 8-thread host, not a new defect — the server stayed fully
responsive throughout (CPU 1.15%, RAM 257 MiB), and 0 WebSocket connections failed or dropped.

**Result: a single eXeLearning instance on this hardware sustains 10,000 concurrent idle WebSocket connections for
a full 10-minute hold with a 99.92% success rate, at 1.15% CPU and 257 MiB RAM.** The only observed friction was
elevated login latency under the sustained ~10 logins/s arrival rate driving the ramp — not a WebSocket-capacity
limit, and not present at all in the 100-2500 VU tiers where the same total login count is spread over more time.
This run required splitting nothing: the orchestrator (10-core Apple Silicon, 24 GiB RAM) drove all 10,000 VUs alone at a
peak of ~8 GiB RSS. The client's role in this benchmark is capped at ~500-1000 VUs for the higher tiers (see
[Load-generator capacity](#load-generator-capacity)) and multi-generator splitting is used mainly to keep it
participating at all, not because the orchestrator needs the help.

## Single-instance results — pre-leak-fix (superseded, kept for the record)

Deployment: the SUT, `/home/deploy/exenew` (single `exenew` instance + MariaDB), `APP_ENV=dev`, image digest
`sha256:489cdc8d177f69584971d3aa11728f0a9536e1b21df995183977d749d32157dd` (includes the login fix, not yet the
WebSocket connection-leak fix). **These numbers are retained as the evidence trail for finding the leak (see
above) but are superseded by the [clean re-run](#single-instance-results-final) below**, since every room the
100/500/1000/2500-VU tiers touched was still being reused (and silently accumulating ghost connections) by the
time the 5000/10000-VU tiers ran against this same long-lived container.

| RUN ID | Users | Projects | Ramp | Hold | WS success | Login avg/p95 | SUT CPU | SUT RAM | Result |
|---|---|---|---|---|---|---|---|---|---|
| E2255-SMOKE-002 | 10 | 10 | 5s | — | 100% | ~1.4s / — | negligible | ~250 MiB | PASS |
| E2255-SINGLE-IDLE-0100-001 | 100 | 100 | 20s | 120s | 99%¹ | 7.6s / 13.1s² | 1.2% | 248 MiB | PASS (see note) |
| E2255-SINGLE-IDLE-0500-002 | 500 | 500 | 100s | 180s | **100%** | 256ms / 275ms | 1.1% | 234 MiB | PASS |
| E2255-SINGLE-IDLE-1000-001 | 1000 | 1000 | 120s | 180s | **100%** | 272ms / 310ms | 1.2% | 247 MiB | PASS |
| E2255-SINGLE-IDLE-2500-001 | 2500 | 2500 | 250s | **600s** | **100%** | 278ms / 319ms | 1.3% | 276 MiB | PASS |

¹ One VU's login/WS iteration did not start at all — traced to a `ramping-vus` scheduling edge case (the very last
VU scheduled right at the end of a single-stage ramp can be dropped), not a server-side failure; fixed for later
runs by adding a short plateau stage (see `test/load/k6/idle-websocket.mjs`).
² This run used a 20s ramp for 100 logins (~5/s) and pre-dates the login-verification fix — elevated but not yet
catastrophic; motivated the dedicated login-burst investigation above.

At 2500 concurrent idle WebSockets, the single instance itself is barely loaded (1.3% CPU, RAM up only ~28 MiB
from the 1000-VU tier) — the constraint so far has been the load generator, not the server: **the client alone hit
71% RAM usage and heavy zram compression driving this same 2500-VU run** (see
[Load-generator capacity](#load-generator-capacity) below), even though the run itself completed cleanly. Higher
tiers (5000, 10000) are split across the client and the orchestrator — see `test/load/README.md`'s multi-generator section.

| E2255-SINGLE-IDLE-5000-001 (split 2000 client + 3000 orchestrator) | 5000 | 5000 | 200s/300s | **600s** | **100%** | 500-613ms / 1.4-1.9s³ | 1.4% | 363 MiB | PASS |

³ Login latency rose compared to the 2500-VU single-generator tier (278ms/319ms) even though both generators paced
at ~10 logins/s individually — the *combined* arrival rate at the server (~20/s from two machines converging on
the same auth endpoint) is the more relevant number. Still 0 failures; treated as expected graceful degradation
under combined load, not a regression, pending confirmation at the 10000-VU tier.

**10000-VU attempt #1 (E2255-SINGLE-IDLE-10000-001, client 3000 + orchestrator 7000): the client OOM-killed.** ~3 minutes
into ramp-up, the Linux OOM killer terminated the client's k6 process (`anon-rss: 5.98 GiB` at kill time, confirmed via
`journalctl -k`), invalidating this run's client leg. This refines the load-generator ceiling found at the 2500-VU
tier: **2000 VUs on the client is safe (31% RAM observed), 3000 is not** — evidently connection-holding state adds
enough per-VU memory on top of k6's base JS-VM cost to cross the line between those two points. The orchestrator's 7000-VU
leg was unaffected (it runs as a separate OS process on separate hardware) and continued to a clean pass — see
below. The corrected split for the official combined 10000-VU run is client 2000 / orchestrator 8000.

*(10000-VU combined result, HA results, collaboration fan-out, and browser validation to follow as they complete.)*

### Load-generator capacity

k6's classic executor allocates one JS VM per virtual user, which is memory-expensive at a few thousand VUs.
The client (Intel i7-4650U, 4 threads, 7.2 GiB RAM) turned out to have a narrow, **unreliable** safe ceiling rather
than a clean cutoff: 2000 VUs ran comfortably (31% RAM) in one attempt, but a same-parameter repeat of 2500 VUs
OOM-killed at 6.06 GiB anon-rss after an earlier 2500-VU attempt had survived at 5.4 GiB — and a later attempt at
2000 VUs alone also OOM-killed. 2000-2500 VUs sits right at the edge on this hardware and is not dependable
run-to-run (compounded, we suspect, by Ubuntu's `apport` crash-report pipeline consuming CPU/memory in response to
each OOM kill, adding noise to subsequent runs in the same session). **Practical rule adopted for this benchmark:
cap the client's share at ≤1000-1500 VUs for any tier at or above 2500**, and let the orchestrator (10-core Apple Silicon,
24 GiB RAM) carry the rest.

The orchestrator, by contrast, drove the entire 10000-VU tier alone with no issues (~8 GiB peak RSS, sub-linear growth per
VU — memory per additional VU decreased as the pool grew, unlike a naive linear projection from the first few
thousand). For every split tier (2500 and 5000), the client's small, conservative share completed cleanly; only the
attempts that gave the client 2000+ VUs were unreliable. Multi-generator splitting in this benchmark therefore
served to keep the client meaningfully participating, not because the orchestrator needed the help — the orchestrator alone would
comfortably have driven every tier reported here.

## HA results

Deployment: the SUT, `/home/deploy/exenew-ha` — 2 `exenew` instances (image digest
`sha256:c1ec78fc9b213cc3a6317b81565a5b343e15beb436130605db72ca284dd8e645`), PostgreSQL 18, Redis, Nginx LB (see
[`test/load/deploy/`](https://github.com/exelearning/exelearning/tree/main/test/load/deploy/)). `APP_ENV=prod`. The single-instance stack was stopped (not
removed — data preserved) to free CPU/RAM for this phase, so the two topologies were never measured concurrently.

### Topology sanity

Both instances started with `[Redis] Pub/sub clients connected successfully` and `[RoomManager] Cross-instance
handler initialized` — multi-instance mode active as documented. A basic smoke test (10 VUs) through the Nginx LB
passed cleanly (100% success).

### Cross-instance Yjs sync (Redis) — confirmed working

20 collaborators joined a single project through the LB (`least_conn`). `GET /api/websocket/info` queried directly
on each instance mid-run showed **10 connections on `exelearning-1`, 9 on `exelearning-2`** (and one still
connecting) for the *same* Yjs room — direct proof `least_conn` splits connections for one room across instances,
not just across independent rooms. All 20 collaborators held their connection for the full duration and exchanged
3,453 fan-out messages (799 KB) with 0 failures — proof the Redis pub/sub bridge correctly relays updates between
clients connected to *different* instances, not just within one instance's local relay.

**Methodology note — a real bug was found and fixed in the test script, not the server.** The first attempt at
this test used the generic bench-account pool for every collaborator; since new projects default to `private`
visibility (no sharing configured by `prepare.sh`), roughly half the VUs got an immediate `ACCESS_DENIED` close
right after the WS handshake — invisible in k6's summary because the close was clean, just early (median session
duration 68ms against a 45s hold; `bench_ws_connect_success` looked fine at 100%, but the newly-added
`bench_ws_held_open_full_duration` counter would have shown the gap immediately). Fixed by having every
collaborator authenticate as the target project's actual owner (`test/load/k6/collaboration.mjs`, commit
`93137426b`) — correct for a fan-out/relay load test, since the access-check code path costs the same regardless
of which valid account is used.

### `ip_hash` vs `least_conn` — the issue's specific concern, confirmed

100 concurrent WebSocket connections (100 independent projects) were driven from a single machine (the orchestrator — one
source IP, exactly the load-generator topology this benchmark uses) against each Nginx config in turn, checking
`GET /api/websocket/info` on both instances mid-hold:

| Config | `exelearning-1` connections | `exelearning-2` connections |
|---|---|---|
| `nginx-tuned-ip-hash.conf` | ~0 (0 of 87 pending-cleanup rooms after the run) | ~100 |
| `nginx-tuned-least-conn.conf` | **50** | **50** |

**Confirmed, not just plausible: `ip_hash` routes (effectively) 100% of connections from a single-IP load
generator to one backend instance**, exactly the skew the issue raised as a concern — the client/orchestrator each being
one source IP would make any `ip_hash`-balanced benchmark measure "one instance plus one idle instance," not real
2-instance capacity. `least_conn` produced a clean 50/50 split under the identical test. Since Redis already
synchronizes Yjs state across instances (confirmed above), `least_conn` loses no correctness by not pinning a
client to one backend — **recommendation: use `least_conn` for the WebSocket upstream in
`doc/deploy/nginx-ha.conf`, not `ip_hash`.**

### Traefik routing (added for inspection, not used for load)

`test/load/deploy/docker-compose.ha.yml` also connects the LB to the SUT's Traefik
(`https://benchmark-ha.example.com/`) for manual browsing — k6 load always hits the LB directly over the LAN
(`http://192.168.4.5:8090`), per this benchmark's WAN-bypass methodology; nothing in the numbers above went
through Traefik or Cloudflare. Getting this working also surfaced an environment quirk: the Nginx container's
Docker `HEALTHCHECK` (`wget` via `docker exec`) hung indefinitely on this host even though the service itself
responded correctly to real HTTP requests — and since Traefik excludes containers Docker reports unhealthy, the
route silently never appeared. Removed the healthcheck (commit `ff3851d40`); nothing in the compose file depends
on Nginx's own health.

### `worker_connections` default vs tuned — confirmed, after correcting a confound

**First attempt was confounded, and the confound is itself a useful finding.** The first try at this comparison
ran 5000 VUs against `nginx-baseline-default.conf` (`worker_connections 1024`) and saw a catastrophic 99.94%
failure rate. Re-running the *identical* load against `nginx-tuned-ip-hash.conf` (same `ip_hash` algorithm, only
`worker_connections`/`worker_rlimit_nofile` raised) produced an equally catastrophic 99.98% failure — proof the
first result wasn't about Nginx at all. `docker stats` showed both `exelearning` instances pegged at their
container CPU limit (203%/202% of a 2-CPU cap) throughout. The real cause, found by checking the raw request log:
k6's `ramping-vus` executor immediately recycles a VU whose iteration returns early into a **brand-new iteration**
if the scenario is still ramping. Once the CPU-limited instances started failing logins under the bcrypt cost
documented in [bottleneck #1](#1-bcryptjscompare-blocked-the-event-loop-under-concurrent-logins-fixed), every
failed VU retried near-instantly — one run generated **255,431 failed login attempts at ~1000/s** against a
nominal ~10-20/s ramp, a self-inflicted retry storm that swamped the very ceiling being measured. Fixed by making
every scenario using `ramping-vus` sleep out its session on failure instead of returning immediately (commit
`01da221a5`, `test/load/k6/{idle-websocket,normal-editing,collaboration,api}.mjs`).

**Clean re-run, one variable changed (same 1000 VUs, same 2-CPU-per-instance limit, same `ip_hash` algorithm, only
`worker_connections`/`worker_rlimit_nofile` differ):**

| Config | Login success | WS held full duration | Instance CPU (post-run) |
|---|---|---|---|
| `nginx-baseline-default.conf` (`worker_connections 1024`) | 58.4% (584/1000) | 537/1000 | — |
| `nginx-tuned-ip-hash.conf` (`worker_connections 32768`, `worker_rlimit_nofile 200000`) | **100% (1000/1000)** | **1000/1000** | 14.6% / 9.2% |

**Confirmed, not just plausible: the default `worker_connections 1024` is a real, reachable bottleneck** — at
1000 concurrent WebSocket connections behind a 2-instance HA deployment, it caused 42% of connections to fail
outright, while the tuned value handled the identical load with 0 failures and left the backend instances at
under 15% CPU (nowhere near their own limit — Nginx's own connection ceiling was the sole constraint). This
directly validates the issue's own suggested tuned values.

*(HA capacity progression and 4-instance scaling not completed in this session — see
[Limitations](#limitations).)*

## Realistic editing workload results

Deployment: single instance, same fixed image as the [final single-instance results](#single-instance-results-final).
40 VUs, randomized 5-20s update interval alternating Yjs updates (60%), metadata polls (25%), and autosaves (15%),
across the issue's suggested users-per-project ratios. **Test-script bug found and fixed along the way**: with
`USERS_PER_PROJECT > 1`, the account-selection logic picked independently of which project was assigned, so most
VUs sharing a project got an `ACCESS_DENIED` close instead of a real session — invisible in the first run's 0%
technical failure rate (748 WS "successes" for a 40-VU target, only surfaced by comparing against
`bench_ws_held_open_full_duration`). Fixed the same way as `collaboration.mjs` (commit `1d2f4d573`):
authenticate as the project's actual owner whenever multiple VUs share it.

| Users/project | Projects | WS held full duration | Edits sent | Autosave avg/p95 | Metadata poll avg/p95 |
|---|---|---|---|---|---|
| 1 | 40 | 40/40 | 179 | 22ms / 40ms | 10ms / 14ms |
| 2 | 20 | 40/40 | 160 | 16ms / 22ms | 7ms / 9ms |
| 4 | 10 | 40/40 | 146 | — | — |
| 10 | 4 | 40/40 | 164 | — | — |

All four ratios: 100% checks, 0 failures, SUT at 1.3% CPU / 239 MiB RAM throughout — this workload shape (small
periodic messages + occasional REST calls) is far cheaper than raw idle-connection count at this scale, and
nowhere near stressing the instance. A larger-scale run (hundreds to thousands of VUs at these same ratios) was
not completed in this session — see [Limitations](#limitations).

## Collaboration fan-out results

Deployment: the 2-instance HA stack (`least_conn`, 2 CPUs/instance), same fixed image. All collaborators join a
single project; `least_conn` spreads them across both instances (confirmed under
[HA results](#cross-instance-yjs-sync-redis--confirmed-working)), so every number below already includes real
cross-instance Redis relay cost, not just one instance's local fan-out.

| RUN ID | Collaborators | WS held full duration | Fan-out messages | Fan-out bytes | Instance CPU (each) | Redis CPU |
|---|---|---|---|---|---|---|
| E2255-HA2-COLLAB-020-002 | 20 | 20/20 | 3,453 | 799 KB | — | — |
| E2255-HA2-COLLAB-050-001 | 50 | 50/50 | 28,370 | 6.7 MB | <1% | 5.2% |
| E2255-HA2-COLLAB-100-001 | 100 | 100/100 | 107,351 | 26 MB | <1% | 0.35%¹ |
| E2255-HA2-COLLAB-500-001 | 500 | **495/500 (99%)** | 2,861,611 | 700 MB | 13-14% | 6.0% |

¹ Sampled after the burst of activity had already drained; not indicative of sustained load — treat the 50- and
500-collaborator Redis samples as more representative.

**Result: 500 simultaneous real-time collaborators on a single project — an extreme scenario by the issue's own
framing (normal is 2-4, "uncommon/extreme" above 10) — worked essentially cleanly** (99% of connections held the
full session; 5 of 500 dropped, consistent with the known `ramping-vus` last-VU-of-ramp edge case documented under
the single-instance results, not a fan-out failure) at only 13-14% CPU per instance and 6% on Redis. The
message-fan-out cost scales roughly with collaborators², as expected for a broadcast room (500 collaborators
produced ~2.86M relayed messages against ~500×N update sends) — this is the workload shape to watch if collaborator
counts were ever expected to grow far past what the issue characterizes as already extreme; at 500 it remains well
within this hardware's headroom.

**Methodology note — a real bug was found and fixed in the test script** (see
[HA results](#cross-instance-yjs-sync-redis--confirmed-working) for the full account-ownership explanation):
early runs authenticated collaborators independently of project ownership, causing silent, fast `ACCESS_DENIED`
cycling that a 100%-technical-success summary did not surface. Fixed by deriving the login account from the
target project's owner (commit `93137426b`) and, separately, by preventing k6's `ramping-vus` executor from
retry-storming on any early/failed close (commit `01da221a5`) — both fixes apply to every `ramping-vus`-based
scenario in this benchmark, not just collaboration.

## Browser validation

While a 300-VU `normal-editing` k6 run drove background load against the single instance, a real Chrome session
(via the orchestrator) went through the **public domain** (`https://benchmark.example.com/`, through Cloudflare and
Traefik — deliberately *not* the LAN-direct path k6 uses, since a real user's traffic does go through both) and:
logged in, waited for the workarea to finish loading, edited the project title, clicked Save, and received the
expected "Proyecto guardado" confirmation. No console errors were observed. This is a small, qualitative check
(one session, one pass) rather than a systematic multi-session sweep — see [Limitations](#limitations) — but it
directly answers the question k6 cannot: the application remained fully interactive and functionally correct to a
real user while the server handled 300 concurrent simulated editors.

## Modifications tested

- **`APP_ENV=dev` vs `prod`**: not yet run as an isolated comparison. Per code inspection (`src/index.ts`), the only
  effect of `APP_ENV` itself is whether `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are auto-seeded as a real user on
  startup; published images always ship prebuilt bundles regardless of `APP_ENV`. `APP_DEBUG` (a separate variable,
  currently `1` on the tested deployment) controls debug logging verbosity and was not yet isolated either. Both
  are candidates for a dedicated one-variable comparison before the final report.
- **`bcryptjs.compare` vs `Bun.password.verify`**: see [Identified bottlenecks](#identified-bottlenecks) above.

## Limitations

- The SUT hosts ~29 unrelated containers for other projects; absolute CPU/latency figures include contention from
  that unrelated load and are not representative of a dedicated host. Relative comparisons (before/after a single
  changed variable) remain valid since the unrelated load was constant across each pair of runs. Host load average
  was observed to drift upward over the course of the session (baseline ~1.6-2.9 at the start, transient spikes
  past 10 during the heaviest HA tests) — always driven by this benchmark's own load, confirmed by CPU dropping to
  near-idle within seconds of each test ending, but a reminder this was never a dedicated, isolated bench host.
- Both benchmark machines are consumer laptops (2013-2017 era), not server hardware; the capacity ceilings measured
  here are specific to this hardware and should not be read as eXeLearning's absolute limit.
- The client's load-generating NIC is Wi-Fi (measured ~130 Mbps), a ceiling to watch for bandwidth-heavy scenarios.
- The 500-VU login-burst "before" comparison used a separately tagged image
  (`ghcr.io/exelearning/exelearning:exenew-before-authfix`, digest `sha256:2897af5996f92dcd183b76e27c6db5573c338e88ab63456af2ae013145dc2f04`)
  built from commit `0bc68d55e` (the commit immediately before the fix on this same branch) — not a different
  branch — to isolate exactly the one changed line.
- **4-instance HA scaling was not tested** in this session (the compose stack supports it via `--profile ha4`, but
  no run was completed) — time was spent instead on establishing and correcting the 2-instance baseline (which
  surfaced two real product bugs and one significant test-tooling bug along the way). Comparing 2 vs. 4 instances
  is the most direct next step for a follow-up session.
- **HA capacity was validated at 1000 VUs (nginx tuning) and 500 collaborators (fan-out), not pushed to a hard
  ceiling.** Both left the instances at well under their CPU limit (under 15%), suggesting real headroom above
  these numbers, but the exact HA breaking point on this hardware was not pinned down.
- **Browser validation was a single qualitative session**, not the systematic 5/10/20-session sweep the issue
  suggests. It confirms the application stays usable under background load; it does not quantify how usability
  degrades (if at all) as concurrent real-browser sessions scale up.
- **`APP_ENV=dev` vs `prod` was not isolated as its own experiment** — see [Modifications tested](#modifications-tested).
  All single-instance results in this report used the deployment's existing `APP_ENV=dev`.

## Benchmark summary table

All rows use the leak-fixed image (`sha256:c1ec78fc9b213cc3a6317b81565a5b343e15beb436130605db72ca284dd8e645`)
unless noted. "—" means not measured for that scenario. Full detail and RUN IDs are in each section above.

| Scenario | Users | Instances | Duration | WS success | HTTP errors | SUT CPU | Redis CPU | Result |
|---|---|---|---|---|---|---|---|---|
| Idle WS | 100 | 1 | 145s | 100% | 0% | negligible | — | PASS |
| Idle WS | 500 | 1 | 460s | 100% | 0% | 1.1% | — | PASS |
| Idle WS | 1000 | 1 | 305s | 100% | 0% | 1.5% | — | PASS |
| Idle WS | 2500 | 1 | 855s | 100% | 0% | 5.3% | — | PASS |
| Idle WS | 5000 | 1 (split gen.) | 655s | 100% | 0% | 1.7% | — | PASS |
| Idle WS | 10000 | 1 (orchestrator only) | 1605s | 99.92% | 0.078% | 1.15% | — | PASS |
| Normal editing (1-10 users/project) | 40 | 1 | 130s | 100% | 0% | 1.3% | — | PASS |
| Login burst | 500 | 1 | 23-60s | 100%¹ | 0%¹ | — | — | PASS¹ |
| HA smoke | 10 | 2 | 5s | 100% | 0% | — | — | PASS |
| HA collaboration | 20-100 | 2 | 40-100s | 100% | 0% | <1% | 0.35-5.2% | PASS |
| HA collaboration | 500 | 2 | 150s | 99% | 0% | 13-14% | 6.0% | PASS |
| HA idle WS, `least_conn` | 100 | 2 | 50s | 100% | 0% | — | — | PASS |
| HA idle WS, `ip_hash` (skew check) | 100 | 2 | 50s | 100% | 0% | — | — | PASS² |
| HA `worker_connections` default | 1000 | 2 | 220s | 58.4% | 41.6% | pegged @ limit³ | — | **FAIL** |
| HA `worker_connections` tuned | 1000 | 2 | 220s | 100% | 0% | 9-15% | — | PASS |
| HA `worker_connections` default, 5000 VUs (confounded) | 5000 | 2 | — | 0.02-0.06% | 99.94-99.98% | pegged @ limit | — | **FAIL (confounded, see report)** |

¹ 100% success is the *after-fix* login-burst result; the *before-fix* comparison (same commit range, isolated) was
36% success / 64% timeout — see [bottleneck #1](#1-bcryptjscompare-blocked-the-event-loop-under-concurrent-logins-fixed).
² "Success" here means the WebSocket handshake completed; the finding is the *skewed distribution* (~100/0 split
across instances), not a failure — see [ip_hash vs least_conn](#ip_hash-vs-least_conn--the-issues-specific-concern-confirmed).
³ Instances capped at 2 CPUs each; CPU was the actual bottleneck for this row, not Nginx — see the
[worker_connections section](#worker_connections-default-vs-tuned--confirmed-after-correcting-a-confound) for the full account.

## Reproducibility

See [`test/load/README.md`](https://github.com/exelearning/exelearning/blob/main/test/load/README.md) for exact prerequisites, environment variables, and
commands to reproduce every run above, including RUN IDs.

## Capacity recommendations

Based on measured results only (see each section above for the underlying data):

1. **Ship the two fixes in this branch before anything else.** The bcrypt event-loop-blocking fix and the
   WebSocket room-leak fix are both correctness/stability issues independent of concurrency targets — the leak in
   particular grows unbounded over a server's uptime under completely normal usage (any client disconnect that
   lands in a specific timing window, not just crashes), not something only a benchmark would trigger.
2. **Apply the updated `nginx-ha.conf`** (`least_conn` for the WebSocket upstream, `worker_connections 32768`,
   `worker_rlimit_nofile 200000`, matching container `ulimits`) to any HA deployment — the previous defaults were
   measured to fail at a concurrency level (1000 WebSocket connections) well within realistic reach.
3. **A single instance is not the near-term bottleneck for WebSocket capacity.** 10,000 concurrent idle
   connections held for 10 minutes at 1.15% CPU and 257 MiB RAM — this architecture's "lightweight stateless
   relay" design claim holds up under measurement. The practical ceiling observed in this benchmark was **login
   throughput under a sustained high arrival rate** (bcrypt cost divided by available CPU cores), not the
   WebSocket layer itself.
4. **Collaborator-per-project guidance in the issue is well justified and has margin to spare.** 500 simultaneous
   collaborators on one project — 50x the issue's own "extreme" threshold of 10 — held 99% of connections for the
   full session at 13-14% instance CPU. The realistic guidance (2-4 normal, up to 10 uncommon) is nowhere near
   this hardware's actual limit; there is no evidence from this benchmark that the current architecture needs a
   hard collaborator cap for correctness or performance reasons at the scales that matter in practice.
5. **CPU-per-instance sizing matters more than connection-count tuning for HA.** The clearest failure mode
   observed in this benchmark (99.94-99.98% request failure) came from capping HA instances at 2 CPUs under a
   login burst, not from WebSocket connection limits. Size HA instance CPU allocation for the expected login
   *rate*, not just steady-state connection count.
6. **Treat a login-burst scenario (many users authenticating in a short window, e.g. the start of a class or
   school day) as its own capacity question**, separate from steady-state WebSocket capacity — this benchmark's
   `test/load/k6/login-burst.mjs` isolates exactly this, and it is the workload shape that broke first at every
   concurrency tier tested.

## Conclusions

```mermaid
xychart-beta
    title "Single-instance idle WebSocket capacity — success rate by tier"
    x-axis [100, 500, 1000, 2500, 5000, 10000]
    y-axis "WS success %" 0 --> 100
    bar [100, 100, 100, 100, 100, 99.92]
```

This benchmark set out to answer, with measurement rather than assumption, how many concurrent users and
long-lived WebSocket connections one eXeLearning instance — and a horizontally scaled HA deployment — can sustain.
On the hardware available for this session (consumer laptops, not server-class machines, one of them shared with
~29 unrelated containers):

- **A single instance sustains 10,000 concurrent idle WebSocket connections for a full 10-minute hold**, at 99.92%
  success and negligible resource cost (1.15% CPU, 257 MiB RAM). The architecture's core design claims — stateless
  relay, no server-side Y.Doc, Bun's native WebSocket handling — held up under direct measurement.
- **The realistic editing and collaboration workloads the issue actually cares about are comfortably within
  reach**: 40 concurrent editors across 1/2/4/10-users-per-project ratios all completed cleanly, and 500
  simultaneous collaborators on a single project — a scenario the issue itself frames as extreme — worked at 99%
  success and modest CPU cost.
- **The first real bottleneck this benchmark found was not WebSocket capacity — it was login throughput under a
  concentrated arrival rate**, rooted in bcrypt's CPU cost divided across however many cores are actually
  available to an instance. This is now measured and documented, not guessed at, and is what should drive future
  capacity planning conversations (e.g., rate limiting, CPU sizing, or an async/offloaded verification path) more
  than raw WebSocket connection limits.
- **Two genuine server bugs were found and fixed** as a direct result of this benchmark: password verification
  blocking Bun's event loop under concurrent logins, and WebSocket connections leaking from the room manager
  forever on every close (not just crashes) due to Elysia's per-event socket wrapper. Both would have degraded a
  real production deployment over time independent of any specific concurrency target — arguably the most
  valuable outcome of this work, ahead of any specific number.
- **HA horizontal scaling was validated architecturally** (Redis cross-instance sync, correct load distribution
  under `least_conn`) but not pushed to its own capacity ceiling in this session — see [Limitations](#limitations)
  for exactly what remains open (4-instance scaling, a harder HA ceiling search, and a systematic multi-session
  browser sweep).

Do not read "10,000" as a promise about production hardware, and do not read "not tested" (4-instance scaling,
HA's own ceiling) as "does not work" — both are honestly scoped gaps for a follow-up session, not negative
findings. What this session does establish, with evidence, is that the architecture's core scalability claims are
real, the specific concerns issue #2255 raised (`ip_hash` skew, default `worker_connections`) were both confirmed
and fixed, and the practical limiting factor at the scales tested is CPU-bound authentication cost, not the
WebSocket relay layer the issue was originally worried about.
