---
id: ADR-2235-10
title: "The preview transport matrix is a single source with a consistency gate"
status: Accepted
date: 2026-07-26
tracking_issue: 2235
legacy_id: ADR-0019
deciders:
  - "@erseco"
related:
  prs: [2199]
  changes: []
  adrs: [ADR-2235-02, ADR-2235-03, ADR-2235-05, ADR-2235-06, ADR-2235-07, ADR-2235-08]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-2235-10: The preview transport matrix is a single source with a consistency gate

## Context

Which isolation the editor preview uses is a security decision with one input — the
runtime — and one modifier — whether the author has enabled custom active content.
[ADR-2235-02](ADR-2235-02-hybrid-preview-trust-boundary.md) established the hybrid boundary;
what it did not establish is *where the decision lives*.

In practice it was spread across `previewContentPolicy.js` (`resolvePreviewTransport`,
`getActivePreviewTrustState`), the preview panel's refresh branches, and the host
capability plumbing. Each is correct today. Nothing stops them diverging tomorrow, and a
divergence here does not throw — it silently renders author content in a weaker origin.

## Problem

Where does the transport decision live, and what stops a second, disagreeing copy of it
appearing?

## Decision drivers

- A security decision that fails **silently** when duplicated is the worst kind to
  duplicate.
- The table must be readable by someone who is not going to read four call sites.
- It must model what the code can actually do — a table describing capabilities the
  runtime does not have is worse than no table.
- Sandbox tokens already have an owner; this must not become a second one.

## Options considered

### Option 1: Document the matrix in prose

Rejected: prose cannot fail a build. This is precisely the class of duplication that
survives review and rots.

### Option 2: One module, and make every other site import it

The obvious answer, and the eventual target. Rejected *for this phase*: the decision is
consumed by browser ES modules and by server TypeScript, and rewiring the live client
path is a behaviour change. Phase 2's remit is "no behaviour change".

### Option 3: One canonical module plus an executable consistency gate (chosen)

Declare the matrix once in `src/shared/preview/preview-mode-matrix.ts`, then have a spec
**execute the shipped client policy** across every cell and fail if the two disagree.
The duplication that remains is pinned rather than trusted, and Phase 3 can collapse it
knowing any drift would already have gone red.

## Evidence

- The default is Service Worker filtering everywhere. Its cost was measured in Phase 0
  at **1–3 ms** on an 8–10 ms generation step, of which the content policy is ~1.4 ms —
  inside a 500 ms-debounced refresh whose SW hand-off is excluded from the measurement.
- The `static` exception is **not** caused by missing HTTP headers. The `sandbox`
  attribute alone already yields an opaque origin with no server involvement. The real
  blocker is that a sandboxed frame without `allow-same-origin` is **never controlled by
  a Service Worker** — verified in Chromium, Firefox and WebKit (Phase 0, spike S3) —
  and a backend-less deployment has nothing else to serve the preview from. Spike S2
  separately established that `online.exelearning.net` is plain nginx and *can* set
  headers, so the exception survives regardless. Project documentation that attributed
  it to headers was wrong and is corrected in
  `doc/development/external-media-inventory.md`.
- `dedicated-origin` is **not** modelled: spike S7 found Electron's custom scheme does
  not satisfy provider embedder checks without rewriting `Referer`/`Origin`
  (`app/main.js:583-618` already does exactly that), so no code path can produce it.
- `playground` (PHP-WASM) is **not** a runtime: nothing in `RuntimeConfig` distinguishes
  it — only `static` and `server` exist — and being backend-less it resolves as
  `static`, which is also the correct security answer for it.

## Decision

We will declare the matrix once, model only what the code can produce, and gate it.

| Runtime | default | active content enabled |
|---|---|---|
| `cloud` | `sw-filtered` | `opaque-capability` |
| `embedded` | `sw-filtered` | `opaque-capability` (host routes) |
| `electron` | `sw-filtered` | `blocked` — the grant is refused |
| `static` | `sw-filtered` | `consented-same-origin` ⚠ warns |

`resolvePreviewTransport(runtime, activeContentEnabled)` returns the transport, a stable
machine-readable `reason`, and `requiresConsentWarning`. An unmodelled runtime
**throws**, because guessing is the silent degradation the matrix exists to prevent.

## Consequences

### Positive

- One readable table; a spec fails if any other site disagrees, proven by mutation
  (claiming `static` can isolate opaquely reddens three assertions).
- Modelling only reachable states keeps the type honest: no transport exists in the
  union that the code cannot produce.
- The no-silent-degradation rule is now asserted, not just intended: the spec checks
  both opaque refresh paths drop the grant and re-render filtered on failure.

### Negative

- The duplication is pinned, not yet removed. The shipped client policy remains a second
  implementation until Phase 3 collapses it.
- Adding a runtime means editing the matrix *and* the runtime mapping in the consistency
  spec. That friction is deliberate.

### Neutral

- Sandbox tokens keep their existing owner (`src/shared/security/previewSandbox.ts`,
  which already has a drift spec against the client constant). The matrix asserts it
  does not restate them.

## Risks

- **The mapping from runtime to `runtimeConfig` shape could itself drift.** Mitigated by
  keeping it in the consistency spec beside the assertions that use it, so a change to
  `RuntimeConfig` that breaks the mapping fails there.
- **`electron/blocked` describes a state the UI refuses to enter.** The spec asserts
  both halves — the grant is refused *and* the resulting preview is filtered — so the
  cell cannot be satisfied by refusing while rendering something weaker.

## Validation

- `src/shared/preview/preview-mode-matrix.spec.ts` — the table, totality, and that
  exactly one cell warns.
- `src/shared/preview/preview-mode-matrix.consistency.spec.ts` — executes
  `previewContentPolicy.js` across all four runtimes × both states, checks revocation
  returns every runtime to filtered, asserts the visible-failure paths, and asserts the
  sandbox tokens still have one owner.
- Mutation-tested: a matrix that disagrees with the shipped policy fails.

## Follow-up work

- Phase 3: make `previewContentPolicy.js` derive from this module instead of restating
  it, at which point the consistency spec becomes a regression test rather than a gate.
- Revisit `dedicated-origin` if spike S7(a) — a real https subdomain for cloud preview —
  is pursued; that one does satisfy provider checks natively.

## References

- `src/shared/preview/preview-mode-matrix.ts`
- `public/app/utils/previewContentPolicy.js`
- `src/shared/security/previewSandbox.ts` — the sandbox token owner
- `doc/development/external-media-inventory.md` — spikes S1, S2, S3, S7
- [ADR-2235-02](ADR-2235-02-hybrid-preview-trust-boundary.md),
  [ADR-2235-07](ADR-2235-07-opfs-service-worker-is-not-an-opaque-origin.md)
