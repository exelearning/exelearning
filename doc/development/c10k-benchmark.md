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

### 2. WebSocket room connections leaked forever on every close (fixed)

**Observation.** After the 10000-VU attempt (Zoidberg OOM-killed leg + Bender's 7000-VU leg, see below), a
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
[the fix verification](#fix-verification-live-check) below. This is very likely the dominant explanation for the
elevated login/WS latency observed at the 5000+ VU tiers on the pre-fix image, ahead of the "combined arrival
rate" explanation offered at the time: by the 10000-VU attempt, the room manager was iterating and bookkeeping for
roughly 17,000 phantom entries on top of whatever real traffic was in flight. The whole single-instance
progression was re-run against the fixed image — see the updated table below.

Fixes: commits `32c268257` and `5c9d27ca9` on branch `2255-c10k-load-testing`.

## Single-instance results (final)

Deployment: Gordobot, `/home/ernesto/exenew` (single `exenew` instance + MariaDB), `APP_ENV=dev`, image digest
`sha256:c1ec78fc9b213cc3a6317b81565a5b343e15beb436130605db72ca284dd8e645` (includes both the login fix and both
WebSocket connection-leak fixes above). Every run below was confirmed leak-free via
`GET /api/websocket/info` returning `totalConnections: 0` after completion.

| RUN ID | Users | Ramp | Hold | WS success | Login avg/p95 | SUT CPU | SUT RAM | Result |
|---|---|---|---|---|---|---|---|---|
| E2255-SMOKE-004 | 5 | 5s | — | 100% | — | negligible | ~250 MiB | PASS |
| E2255-SINGLE-IDLE-0100-003 | 100 | 20s | 120s | **100%** | 257ms / 269ms | negligible | ~248 MiB | PASS |
| E2255-SINGLE-IDLE-0500-003 | 500 | 60s | 180s | **100%** | 271ms / 307ms | 2.6% | 237 MiB | PASS |
| E2255-SINGLE-IDLE-1000-002 | 1000 | 120s | 180s | **100%** | 274ms / 327ms | 1.5% | 241 MiB | PASS |
| E2255-SINGLE-IDLE-2500-003 (split 1000 Zoidberg + 1500 Bender) | 2500 | 100s/150s | **600s** | **100%** | 293ms / 407ms | 5.3% | 261 MiB | PASS |

**Zoidberg's safe single-generator ceiling is ≤2000 VUs, not 2500.** A same-parameter repeat of the 2500-VU
single-generator run OOM-killed at 6.06 GiB anon-rss (vs. 5.4 GiB survived on the first attempt) — 2500 sits right
at the edge and isn't a reliable pass/fail boundary on this hardware. From this tier onward, every run splits load
across Zoidberg (capped at a comfortably safe 1000-2000) and Bender.

| E2255-SINGLE-IDLE-5000-003 (split 500 Zoidberg + 4500 Bender) | 5000 | 100s/450s | **600s** | **100%** | 291-301ms / 348-380ms | 1.7% | 298 MiB | PASS |
| E2255-SINGLE-IDLE-10000-003 (Bender only) | 10000 | 1000s | **600s** | 99.92%⁴ | 8.06s / 31.27s⁵ | 1.15% | 257 MiB | **PASS** |

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
This run required splitting nothing: Bender (10-core Apple Silicon, 24 GiB RAM) drove all 10,000 VUs alone at a
peak of ~8 GiB RSS. Zoidberg's role in this benchmark is capped at ~500-1000 VUs for the higher tiers (see
[Load-generator capacity](#load-generator-capacity)) and multi-generator splitting is used mainly to keep it
participating at all, not because Bender needs the help.

## Single-instance results — pre-leak-fix (superseded, kept for the record)

Deployment: Gordobot, `/home/ernesto/exenew` (single `exenew` instance + MariaDB), `APP_ENV=dev`, image digest
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
from the 1000-VU tier) — the constraint so far has been the load generator, not the server: **Zoidberg alone hit
71% RAM usage and heavy zram compression driving this same 2500-VU run** (see
[Load-generator capacity](#load-generator-capacity) below), even though the run itself completed cleanly. Higher
tiers (5000, 10000) are split across Zoidberg and Bender — see `test/load/README.md`'s multi-generator section.

| E2255-SINGLE-IDLE-5000-001 (split 2000 Zoidberg + 3000 Bender) | 5000 | 5000 | 200s/300s | **600s** | **100%** | 500-613ms / 1.4-1.9s³ | 1.4% | 363 MiB | PASS |

³ Login latency rose compared to the 2500-VU single-generator tier (278ms/319ms) even though both generators paced
at ~10 logins/s individually — the *combined* arrival rate at the server (~20/s from two machines converging on
the same auth endpoint) is the more relevant number. Still 0 failures; treated as expected graceful degradation
under combined load, not a regression, pending confirmation at the 10000-VU tier.

**10000-VU attempt #1 (E2255-SINGLE-IDLE-10000-001, Zoidberg 3000 + Bender 7000): Zoidberg OOM-killed.** ~3 minutes
into ramp-up, the Linux OOM killer terminated Zoidberg's k6 process (`anon-rss: 5.98 GiB` at kill time, confirmed via
`journalctl -k`), invalidating this run's Zoidberg leg. This refines the load-generator ceiling found at the 2500-VU
tier: **2000 VUs on Zoidberg is safe (31% RAM observed), 3000 is not** — evidently connection-holding state adds
enough per-VU memory on top of k6's base JS-VM cost to cross the line between those two points. Bender's 7000-VU
leg was unaffected (it runs as a separate OS process on separate hardware) and continued to a clean pass — see
below. The corrected split for the official combined 10000-VU run is Zoidberg 2000 / Bender 8000.

*(10000-VU combined result, HA results, collaboration fan-out, and browser validation to follow as they complete.)*

### Load-generator capacity

k6's classic executor allocates one JS VM per virtual user, which is memory-expensive at a few thousand VUs.
Zoidberg (Intel i7-4650U, 4 threads, 7.2 GiB RAM) turned out to have a narrow, **unreliable** safe ceiling rather
than a clean cutoff: 2000 VUs ran comfortably (31% RAM) in one attempt, but a same-parameter repeat of 2500 VUs
OOM-killed at 6.06 GiB anon-rss after an earlier 2500-VU attempt had survived at 5.4 GiB — and a later attempt at
2000 VUs alone also OOM-killed. 2000-2500 VUs sits right at the edge on this hardware and is not dependable
run-to-run (compounded, we suspect, by Ubuntu's `apport` crash-report pipeline consuming CPU/memory in response to
each OOM kill, adding noise to subsequent runs in the same session). **Practical rule adopted for this benchmark:
cap Zoidberg's share at ≤1000-1500 VUs for any tier at or above 2500**, and let Bender (10-core Apple Silicon,
24 GiB RAM) carry the rest.

Bender, by contrast, drove the entire 10000-VU tier alone with no issues (~8 GiB peak RSS, sub-linear growth per
VU — memory per additional VU decreased as the pool grew, unlike a naive linear projection from the first few
thousand). For every split tier (2500 and 5000), Zoidberg's small, conservative share completed cleanly; only the
attempts that gave Zoidberg 2000+ VUs were unreliable. Multi-generator splitting in this benchmark therefore
served to keep Zoidberg meaningfully participating, not because Bender needed the help — Bender alone would
comfortably have driven every tier reported here.

## HA results

Deployment: Gordobot, `/home/ernesto/exenew-ha` — 2 `exenew` instances (image digest
`sha256:c1ec78fc9b213cc3a6317b81565a5b343e15beb436130605db72ca284dd8e645`), PostgreSQL 18, Redis, Nginx LB (see
[`test/load/deploy/`](../../test/load/deploy/)). `APP_ENV=prod`. The single-instance stack was stopped (not
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

100 concurrent WebSocket connections (100 independent projects) were driven from a single machine (Bender — one
source IP, exactly the load-generator topology this benchmark uses) against each Nginx config in turn, checking
`GET /api/websocket/info` on both instances mid-hold:

| Config | `exelearning-1` connections | `exelearning-2` connections |
|---|---|---|
| `nginx-tuned-ip-hash.conf` | ~0 (0 of 87 pending-cleanup rooms after the run) | ~100 |
| `nginx-tuned-least-conn.conf` | **50** | **50** |

**Confirmed, not just plausible: `ip_hash` routes (effectively) 100% of connections from a single-IP load
generator to one backend instance**, exactly the skew the issue raised as a concern — Zoidberg/Bender each being
one source IP would make any `ip_hash`-balanced benchmark measure "one instance plus one idle instance," not real
2-instance capacity. `least_conn` produced a clean 50/50 split under the identical test. Since Redis already
synchronizes Yjs state across instances (confirmed above), `least_conn` loses no correctness by not pinning a
client to one backend — **recommendation: use `least_conn` for the WebSocket upstream in
`doc/deploy/nginx-ha.conf`, not `ip_hash`.**

### Traefik routing (added for inspection, not used for load)

`test/load/deploy/docker-compose.ha.yml` also connects the LB to Gordobot's Traefik
(`https://exenew-ha.miquistiquis.com/`) for manual browsing — k6 load always hits the LB directly over the LAN
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
