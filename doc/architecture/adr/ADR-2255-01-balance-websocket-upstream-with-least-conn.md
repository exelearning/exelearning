---
id: ADR-2255-01
title: "Balance the WebSocket upstream with least_conn, not ip_hash"
status: Proposed
date: 2026-09-02
tracking_issue: 2255
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: [2315]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-2255-01: Balance the WebSocket upstream with least_conn, not ip_hash

## Context

The reference high-availability topology documented in
[`doc/high-availability.md`](../../high-availability.md) runs several eXeLearning
instances behind Nginx, with Redis relaying Yjs updates between them. The sample
load-balancer configuration shipped for that topology,
[`doc/deploy/nginx-ha.conf`](../../deploy/nginx-ha.conf), used two different
balancing strategies: `least_conn` for the HTTP upstream, and `ip_hash` for the
`/yjs/*` WebSocket upstream. The rationale recorded in the file for the
exception was latency — pinning a client to one backend so its Yjs room state
stays local — with a note that Redis synchronization made the pinning
"optional".

`ip_hash` distributes by *source IP*, not by client. That is only equivalent to
distributing by client when every client reaches Nginx from a distinct address.
Real deployments frequently break that assumption: a school or campus behind a
single NAT gateway, an LMS-side proxy, a CDN or tunnel edge, and — the case that
surfaced this — a load generator.

Issue [#2255](https://github.com/exelearning/exelearning/issues/2255) asked how
many concurrent users and long-lived WebSocket connections this architecture
actually sustains, and raised the concern directly: a benchmark driven from one
or two machines would, under `ip_hash`, land every connection on a single
instance and therefore measure one busy instance plus one idle one rather than
real two-instance capacity. That made the balancing strategy a prerequisite for
trustworthy measurements, and the measurements in turn produced the evidence to
settle it.

The full methodology and results are in
[`doc/development/c10k-benchmark.md`](../../development/c10k-benchmark.md)
(Spanish: [`c10k-benchmark.es.md`](../../development/c10k-benchmark.es.md)).

## Problem

Which upstream balancing algorithm should the reference HA configuration use for
the WebSocket upstream, given that Redis already synchronizes Yjs state across
instances and that source IPs are not a reliable proxy for distinct clients?

## Decision drivers

- **Even load distribution.** Concurrent WebSocket connections are the dominant
  long-lived resource in this architecture; a strategy that can send effectively
  all of them to one instance defeats the purpose of running several.
- **Correctness under the existing design.** Whatever is chosen must not depend
  on a client staying pinned to one backend, because the collaboration model
  already assumes cross-instance relay through Redis.
- **Realistic client topologies.** Institutional users arrive through shared
  egress addresses; LMS embedding adds proxies. The default must behave well when
  many clients share one IP.
- **Measurability.** The configuration used for capacity testing must be the one
  recommended for production, or the numbers describe a system nobody runs.
- **Operational simplicity.** No extra components (sticky-session modules,
  cookie-based affinity, external session stores) for a benefit the architecture
  does not need.

## Options considered

### Option 1: Keep `ip_hash`

Pins each source IP to one backend for the lifetime of that address's mapping.

- Pro: a client's connections stay on one instance, so its room state is local
  and the Redis hop is skipped for same-instance peers.
- Pro: zero additional configuration; already in the file.
- Con: distributes by source IP, so any shared egress point (NAT, proxy, CDN,
  tunnel, load generator) concentrates load on one instance — measured below as
  ~100% skew.
- Con: rebalancing on instance failure re-hashes a whole IP group at once.
- Con: the affinity it buys is not needed for correctness, because Redis already
  relays updates between instances.

### Option 2: `least_conn`

Sends each new connection to the backend with the fewest active connections.

- Pro: directly optimizes the resource that matters here — the count of
  long-lived WebSocket connections — regardless of how many source IPs exist.
- Pro: no dependency on client-to-backend affinity, which Redis makes
  unnecessary.
- Pro: single directive; no additional components.
- Con: two clients in the same Yjs room may land on different instances, so
  their updates traverse Redis instead of the instance-local relay.

### Option 3: Round-robin (Nginx's default)

- Pro: simplest possible distribution; even in the long run.
- Con: even *connection counts* only if connection lifetimes are similar; with
  long-lived WebSocket sessions that arrive and leave at different rates, a
  restarted or newly added instance stays under-loaded while the others hold
  their existing connections.

### Option 4: Explicit sticky sessions (cookie/route-based affinity)

- Pro: real per-client affinity, unaffected by shared source IPs.
- Con: requires `nginx-plus` or a third-party module for cookie stickiness, plus
  cookie plumbing through the WebSocket handshake.
- Con: pays that complexity for an optimization the architecture does not need,
  and reintroduces the same rebalancing problem on failover.

## Evidence

All measurements are from the #2255 benchmark; the deployment variants used are
committed under [`test/load/deploy/`](../../../test/load/deploy/) so they can be
re-run.

**1. Redis cross-instance relay works, so affinity is not needed for
correctness.** 20 collaborators joined a single project through the load balancer
under `least_conn`. `GET /api/websocket/info`, queried on each instance
mid-run, reported 10 connections on `exelearning-1` and 9 on `exelearning-2` for
the *same* Yjs room. All 20 held their connection for the full run and exchanged
3,453 fan-out messages (799 KB) with 0 failures — updates were relayed correctly
between clients on *different* instances
([report § Cross-instance Yjs sync](../../development/c10k-benchmark.md#cross-instance-yjs-sync-redis--confirmed-working)).

**2. `ip_hash` concentrates single-source load on one instance.** 100 concurrent
WebSocket connections (100 independent projects) were driven from one machine —
one source IP — against each configuration in turn, with
`GET /api/websocket/info` checked on both instances mid-hold:

| Config | `exelearning-1` | `exelearning-2` |
|---|---|---|
| `nginx-tuned-ip-hash.conf` | ~0 | ~100 |
| `nginx-tuned-least-conn.conf` | **50** | **50** |

([report § `ip_hash` vs `least_conn`](../../development/c10k-benchmark.md#ip_hash-vs-least_conn--the-issues-specific-concern-confirmed))

**3. The Redis hop is not a measured bottleneck at the scales tested.** Under
`least_conn`, 500 simultaneous collaborators on a single project — the case where
cross-instance relay is most exercised — held 99% of connections for the full
session at 13-14% CPU per instance
([report § Collaboration fan-out](../../development/c10k-benchmark.md#collaboration-fan-out-results)).

**4. The same benchmark invalidated the sample file's `events` block.** With
`worker_connections 1024`, 1000 concurrent WebSocket connections through the LB
gave 58.4% login success and 537/1000 connections held; with
`worker_connections 32768` / `worker_rlimit_nofile 200000` and *only* those two
values changed, the identical load gave 100% success at under 15% instance CPU
([report § `worker_connections`](../../development/c10k-benchmark.md#worker_connections-default-vs-tuned--confirmed-after-correcting-a-confound)).
This is tuning rather than an architectural decision, but it ships in the same
file and is recorded here so the file's provenance is in one place.

## Decision

We will balance the WebSocket upstream in the reference HA configuration with
**`least_conn`**, and stop using `ip_hash` there. The HTTP upstream already used
`least_conn`, so both upstreams now share one strategy and the configuration has
no per-protocol exception to explain.

The reasoning is that client-to-backend affinity is an optimization, not a
correctness requirement — Redis already relays Yjs updates across instances, as
measured — while the skew `ip_hash` introduces under shared egress addresses is a
correctness-adjacent failure of the HA topology itself: instances that exist but
receive no load.

The sample file's `events` limits are raised in the same change
(`worker_connections 32768`, `worker_rlimit_nofile 200000`), since the previous
defaults were measured to fail at 1000 concurrent connections.

## Consequences

### Positive

- Connections spread evenly across instances regardless of how many source IPs
  the load arrives from, including the institutional-NAT and LMS-proxy cases.
- Adding an instance immediately attracts new connections; it does not wait for
  an IP-hash bucket to be reassigned.
- Capacity benchmarks driven from a small number of generator machines measure
  the real topology, so the numbers in the report describe the recommended
  configuration.
- The reference configuration stays plain open-source Nginx.

### Negative

- Two collaborators in the same room may sit on different instances, so their
  updates take the Redis hop rather than the instance-local relay. Measured cost
  at 500 collaborators on one project: not distinguishable from noise (13-14%
  CPU per instance, 99% of connections held for the full session).
- Redis becomes load-bearing for a larger share of update traffic than under
  `ip_hash`, which makes the Redis instance's availability more important. The HA
  document already treats Redis as required for multi-instance operation.

### Neutral

- Only the reference/sample configuration changes. Operators running their own
  load balancer are unaffected until they adopt it.
- No application code changes: nothing in `src/websocket/` depends on which
  instance a client lands on.

## Risks

- **Redis becomes a single point of failure for cross-instance relay.** Already
  true for multi-instance deployments; `least_conn` raises how much traffic
  depends on it. Mitigation: the HA document's existing Redis guidance
  (persistence, monitoring); operators needing more can run Redis in HA mode.
- **Deployments that genuinely benefit from locality lose it.** A single-tenant
  install where every collaborator shares one room and one egress IP would have
  had instance-local relay under `ip_hash`. Mitigation: such a deployment is
  usually better served by one larger instance; the directive is one line to
  change for operators who measure otherwise.
- **`least_conn` counts connections, not cost.** An instance holding many idle
  sockets looks busier than one holding a few very active rooms. At the measured
  per-connection cost (10,000 idle connections on one instance at 1.15% CPU and
  257 MiB RAM), connection count is a reasonable proxy.

## Validation

- The `ip_hash`/`least_conn` split measurement above is reproducible: the two
  Nginx configurations are committed under
  [`test/load/deploy/`](../../../test/load/deploy/), and
  [`test/load/README.md`](../../../test/load/README.md) documents the commands.
- `GET /api/websocket/info` on each instance is the check: under `least_conn`,
  connections from one source IP must be split roughly evenly.
- Re-validate when the collaboration transport changes (a different relay than
  Redis pub/sub, or per-room server-side state) — those would change whether
  affinity is optional.

## Follow-up work

- Consider whether `doc/deploy/docker-compose.redis.yml` should document Redis
  availability expectations more explicitly, now that cross-instance relay is on
  the common path rather than the exception.
- Re-run the collaboration fan-out scenario beyond 500 collaborators on one
  project if a deployment approaches that scale, to find where the Redis hop
  starts to matter.

## References

- Issue [#2255](https://github.com/exelearning/exelearning/issues/2255) — C10k
  load testing, including the `ip_hash` skew concern.
- PR [#2315](https://github.com/exelearning/exelearning/pull/2315) — benchmark
  report, tooling, and the configuration change.
- [`doc/development/c10k-benchmark.md`](../../development/c10k-benchmark.md) /
  [`c10k-benchmark.es.md`](../../development/c10k-benchmark.es.md) — methodology,
  measurements, limitations.
- [`doc/deploy/nginx-ha.conf`](../../deploy/nginx-ha.conf) — the configuration
  this decision changes.
- [`doc/high-availability.md`](../../high-availability.md) — the topology and its
  Redis requirement.
- [`test/load/deploy/`](../../../test/load/deploy/) — `nginx-tuned-ip-hash.conf`,
  `nginx-tuned-least-conn.conf`, `nginx-baseline-default.conf` and the HA compose
  file used for the comparisons.
- [ADR-2255-02](ADR-2255-02-verify-passwords-with-bun-native-bcrypt.md) — the
  other durable decision from the same benchmark.
- Nginx documentation:
  [`ngx_http_upstream_module`](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
  (`least_conn`, `ip_hash`).
