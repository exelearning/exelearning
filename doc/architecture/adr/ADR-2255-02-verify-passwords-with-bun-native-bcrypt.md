---
id: ADR-2255-02
title: "Verify passwords with Bun's native bcrypt, never with pure-JS bcryptjs"
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
  adrs: [ADR-2261-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-2255-02: Verify passwords with Bun's native bcrypt, never with pure-JS bcryptjs

## Context

eXeLearning's backend runs on Bun, which executes all JavaScript on a single
thread. Any CPU-bound work done synchronously in JavaScript therefore blocks not
just its own request but the entire event loop, including unrelated endpoints.

Password verification is deliberately CPU-bound: bcrypt's cost factor exists to
make each check expensive. The project stored local passwords with Bun's native
`Bun.password.hash()` (`src/services/password.ts`), but verified them with
`bcrypt.compare()` from the pure-JS [`bcryptjs`](https://www.npmjs.com/package/bcryptjs)
package — both in the shared `verifyPassword()` service and, duplicated, inline
in the two login routes (`src/routes/auth.ts`). `bcryptjs` computes bcrypt in
JavaScript, on that single thread.

The mixture was not intentional design; it accumulated. It only became visible
under load: the [#2255](https://github.com/exelearning/exelearning/issues/2255)
capacity benchmark hit widespread `POST /api/auth/login: request timeout` errors
long before any WebSocket capacity limit was reached, which made it impossible to
measure anything else until the cause was found.

Login is also the entry point to every load scenario worth measuring — a user
must authenticate before opening a project or a collaboration session — so its
throughput bounds the whole system's measurable capacity.

## Problem

Which bcrypt implementation does the authentication path use for verification,
and where is that choice enforced, so that concurrent logins cannot stall
unrelated request handling on Bun's single JS thread?

## Decision drivers

- **Event-loop safety.** No routinely-reached request path may occupy the single
  JS thread for a duration proportional to concurrent load.
- **No password migration.** Whatever is chosen must accept the bcrypt hashes
  already stored by every existing installation. Forcing a reset is not
  acceptable.
- **Unchanged security properties.** Same algorithm, same cost factor, same
  constant-time comparison guarantees. This is an implementation swap, not a
  cryptographic change.
- **Single source of truth.** AGENTS.md requires shared logic to live in one
  function; two routes calling `bcrypt.compare()` directly is exactly the
  duplication that let the mismatch survive.
- **Runtime alignment.** The project already commits to Bun; using its native
  primitives where they exist is the lower-maintenance path.

## Options considered

### Option 1: Keep `bcryptjs.compare()`

- Pro: no change; works correctly at low concurrency.
- Con: pure-JS bcrypt serializes on Bun's single thread — measured below to stall
  *all* request handling, not just logins.
- Con: inconsistent with `Bun.password.hash()`, already used for hashing.

### Option 2: `Bun.password.verify()` (native, off-thread)

Bun's native password API runs bcrypt/argon2 outside the JS thread and reads the
algorithm and cost from the hash prefix itself.

- Pro: does not block the event loop.
- Pro: verifies existing hashes — a bcrypt hash is a bcrypt hash regardless of
  which implementation produced it, so no migration and no dual-path fallback.
- Pro: pairs with `Bun.password.hash()`, already in use; removes the `bcryptjs`
  dependency from the auth path.
- Con: ties the auth path to the Bun runtime. The backend already requires Bun,
  so this is a restatement of an existing commitment rather than a new one.

### Option 3: Keep `bcryptjs`, but move it to a worker thread or a queue

- Pro: keeps the dependency runtime-agnostic.
- Con: adds a worker pool, message passing and a failure mode (worker crash,
  saturation) to solve a problem the runtime already solves natively.
- Con: still pays pure-JS bcrypt's cost, merely elsewhere.

### Option 4: Lower the bcrypt cost factor

- Pro: cheapest possible change; reduces the per-verification cost directly.
- Con: weakens password security to work around an implementation defect. The
  cost factor is the security parameter; the blocking was not caused by it.
- Rejected on principle.

## Evidence

Two container images were built from the same commit range, differing **only** in
`verifyPassword()`'s implementation (commit `19ae39ed8` on branch
`2255-c10k-load-testing`). Each ran `login-burst.mjs` at 500 concurrent VUs
(`shared-iterations`, one login per VU) while a separate probe polled the
unrelated `/healthcheck` endpoint every 200 ms throughout:

| | Before (`bcryptjs.compare`) | After (`Bun.password.verify`) |
|---|---|---|
| Login success rate | 36% (180/500) | **100% (500/500)** |
| Login failures | 320 timeouts (60 s) | 0 |
| Login latency (avg / p95) | 50.85 s / 59.99 s | 12.99 s / 21.28 s |
| `/healthcheck` samples completed in 40 s | 7 (most calls stalled) | 143 (full rate) |
| `/healthcheck` latency (p50 / p95 / max) | 8 ms / 2.8 s / **138.3 s** | 11.6 ms / 58 ms / 117 ms |

The `/healthcheck` column is the decisive one: a trivially cheap endpoint that
touches no authentication code stalled for up to **138 seconds** during the
login burst. That is event-loop blocking, not login slowness — the effect was
system-wide.

Residual latency at 500 *simultaneous* logins (avg ~13 s) is genuine bcrypt CPU
cost on the shared, contended 8-thread benchmark host, not a defect: in the
editing and idle-WebSocket scenarios, where logins are spread over a ramp rather
than arriving as one instant burst, login latency stayed in the 250-350 ms range
even at 2500 VUs.

Existing hashes were verified unchanged: the benchmark accounts were created
before the switch (via `bcryptjs.hash`) and logged in successfully after it, with
no migration step — `Bun.password.verify()` reads the algorithm from the stored
hash.

Full write-up:
[report § Identified bottlenecks #1](../../development/c10k-benchmark.md#1-bcryptjscompare-blocked-the-event-loop-under-concurrent-logins-fixed)
(Spanish: [`c10k-benchmark.es.md`](../../development/c10k-benchmark.es.md)).

## Decision

We will verify passwords with **`Bun.password.verify()`**, and route **every**
verification through the single `verifyPassword()` function in
`src/services/password.ts`. `bcryptjs.compare()` is not used in the
authentication path; the two inline calls in `src/routes/auth.ts` now call
`verifyPassword()`.

Hashing continues to use `Bun.password.hash()`, as before. No stored hash
changes and no user has to reset a password: the native API reads the algorithm
and cost from the hash itself, so hashes written by `bcryptjs` and by
`Bun.password.hash()` are both accepted.

More generally: **CPU-bound cryptographic work in a request path must use a
native implementation that does not run on the JS thread.** Pure-JS crypto is not
acceptable on a routinely-reached path in a Bun server. The remaining
`bcryptjs.hash()` call sites listed under Consequences fall under the same rule;
they sit on much colder paths and are recorded as follow-up work.

## Consequences

### Positive

- Concurrent logins no longer stall unrelated request handling. A login burst is
  bounded by CPU, not by a serialized JS thread.
- The system's measured capacity ceiling moved from "logins time out at a few
  hundred concurrent requests" to genuine bcrypt CPU cost divided by available
  cores.
- One verification path instead of three call sites, so a future change to
  hashing or verification has exactly one place to change — the same property
  [ADR-2261-01](ADR-2261-01-scope-password-changes-to-local-accounts.md) relies
  on for deciding which accounts may change a password.
- No migration, no dual-path fallback, no user-visible change.

### Negative

- The authentication path now depends on a Bun-specific API. Running the backend
  on another JS runtime would require restoring a portable implementation — and
  would reintroduce the blocking problem unless that runtime offers an
  equivalent native primitive.

### Neutral

- `bcryptjs` remains in the dependency tree and is still used for *hashing* at
  three low-frequency sites: random-password generation for newly created
  CAS/OIDC/guest accounts (`src/routes/auth.ts:674`, `:1011`, `:1129`) and the
  administrative password set (`src/routes/admin.ts:1069`). These are the same
  class of hazard on a much colder path — a first external login or an admin
  action, not every login — and are listed under follow-up work rather than
  changed here, because the benchmark measured verification, not hashing.
- It is no longer used to verify a password during authentication, which was the
  measured hot path.
- The cost factor and algorithm are unchanged, so per-verification CPU cost is
  the same. Only *where* that work runs changed.

## Risks

- **A future contributor reintroduces `bcrypt.compare()` in a route.** This is
  precisely how the defect arose. Mitigation: the single `verifyPassword()`
  entry point, its explanatory comment citing this benchmark, and review
  attention on any direct `bcryptjs` import in `src/routes/`.
- **Bun changes `Bun.password` semantics.** Mitigation: the behavior relied on
  (algorithm read from the hash prefix) is the documented contract of the API;
  authentication is covered by unit and E2E tests that would fail on a
  regression.
- **Login throughput is still CPU-bound.** At a sustained high arrival rate,
  bcrypt cost divided by available cores is the real ceiling — a capacity-planning
  fact, not a defect. It is recorded in the benchmark's capacity
  recommendations.

## Validation

- `src/services/password.spec.ts` and the auth route specs cover verification,
  including hashes produced by the previous implementation.
- The blocking behavior is reproducible: `test/load/k6/login-burst.mjs` plus
  `test/load/scripts/probe-responsiveness.sh` reproduce the exact experiment
  above; see [`test/load/README.md`](../../../test/load/README.md).
- The signal to watch in future benchmarks is the unrelated-endpoint probe, not
  login latency: if a cheap endpoint's p95 rises with login concurrency,
  something is blocking the event loop again.

## Follow-up work

- Move the four remaining `bcryptjs.hash()` call sites
  (`src/routes/auth.ts:674`, `:1011`, `:1129`; `src/routes/admin.ts:1069`) onto
  the shared `hashPassword()` service, which already uses `Bun.password.hash()`.
  That removes `bcryptjs` from the request path entirely and restores the
  single-source-of-truth property for hashing as well as verification.
- Once that is done, drop the `bcryptjs` dependency if nothing else needs it.
- Consider a lint rule or CI grep that fails on a direct `bcryptjs` import under
  `src/routes/`.

## References

- Issue [#2255](https://github.com/exelearning/exelearning/issues/2255) — C10k
  load testing.
- PR [#2315](https://github.com/exelearning/exelearning/pull/2315) — benchmark
  report, tooling, and this fix.
- Commit `19ae39ed8` — `perf(auth): verify passwords with Bun's native bcrypt,
  not bcryptjs`.
- [`doc/development/c10k-benchmark.md`](../../development/c10k-benchmark.md) /
  [`c10k-benchmark.es.md`](../../development/c10k-benchmark.es.md) — the
  experiment, its numbers and its limitations.
- [`src/services/password.ts`](../../../src/services/password.ts),
  [`src/routes/auth.ts`](../../../src/routes/auth.ts) — the implementation.
- [`test/load/k6/login-burst.mjs`](../../../test/load/k6/login-burst.mjs),
  [`test/load/scripts/probe-responsiveness.sh`](../../../test/load/scripts/probe-responsiveness.sh)
  — the reproducible experiment.
- [Bun `Bun.password` documentation](https://bun.sh/docs/api/hashing#bun-password).
- [ADR-2261-01](ADR-2261-01-scope-password-changes-to-local-accounts.md) — which
  accounts may change an eXeLearning-managed password.
- [ADR-2255-01](ADR-2255-01-balance-websocket-upstream-with-least-conn.md) — the
  other durable decision from the same benchmark.
