---
id: ADR-0007
title: "Select preview transport through an explicit provider abstraction"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0002]
  adrs: [ADR-0006, ADR-0008, ADR-0011]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0007: Select preview transport through an explicit provider abstraction

## Status

Proposed

## Context

Opaque preview (ADR-0006) cannot be served the same way in every runtime: a
cloud/server editor has a real HTTP backend, Electron has an in-process protocol,
an embedded LMS editor or a static/PWA build has no backend at all, and a Service
Worker cannot back an opaque frame. Each context needs a different serving
mechanism while honoring the same preview contract.

## Problem

How is the preview transport chosen per runtime, and how do we prevent an
unavailable transport from silently falling back to an unsafe same-origin preview?

## Decision drivers

- Determinism and testability of selection.
- No silent downgrade to same-origin.
- One shared preview client contract across transports.
- An explicit escape hatch for hosts that need to override.

## Options considered

### Option 1: Explicit provider abstraction with deterministic selection

A `previewTransport` resolver maps runtime signals to a provider
(`Http`/`Srcdoc`/`ServiceWorker`), each implementing one contract; selection is a
pure function with an explicit override. Pros: deterministic, testable, no hidden
fallback. Cons: more structure than an ad-hoc branch.

### Option 2: Implicit runtime probing / try-and-fallback

Probe capabilities and fall back on failure. Pros: fewer config knobs. Cons: a
failed opaque transport could silently downgrade to same-origin — exactly the risk
we are removing; hard to test.

### Option 3: One transport for all (e.g. `srcdoc` everywhere)

Pros: simplest. Cons: loses HTTP fidelity (real per-page URLs, open-in-new-tab,
runtime-URL features) and the server/Electron capabilities.

## Evidence

At `fix/opaque-iframe-external-media` @ `7da657a31`:
- `public/app/core/previewTransport.js` and
  `public/app/workarea/interface/elements/preview/selectPreviewProvider.js`:
  explicit `embeddingConfig.previewTransport` override → `mode==='server'` → `http`
  → Electron → `http` (`app://`) → else → `srcdoc`; only the `legacy-sw` override
  yields the Service Worker provider.
- Providers `HttpPreviewProvider.js` / `SrcdocPreviewProvider.js` /
  `ServiceWorkerPreviewProvider.js` and the shared `providerContract.js`.
- Tests: `previewTransport.test.js`, `selectPreviewProvider.test.js`, and each
  provider's `*.test.js`.

## Decision

We will select the preview transport through an explicit provider abstraction with
deterministic resolution and no runtime fallback chain. `ServiceWorkerPreviewProvider`
(`opaqueSafe = false`) is reachable only via the explicit `legacy-sw` override.

## Consequences

### Positive

- Selection is deterministic and unit-tested; an unavailable transport surfaces an
  error instead of degrading to same-origin.
- New transports (Electron `app://`) slot in without touching call sites.

### Negative

- Hosts that want HTTP fidelity must opt in explicitly (`previewTransport: 'http'`
  + a serving endpoint).

### Neutral

- The legacy Service Worker transport survives as an explicit, non-default option.

## Risks

- A misconfigured override could select the legacy same-origin transport.
  Mitigation: `legacy-sw` is documented as dev/interim-only and `opaqueSafe=false`.

## Validation

`previewTransport.test.js` / `selectPreviewProvider.test.js` assert the mapping and
that `service-worker` is never selected implicitly.

## Follow-up work

- Add an `ElectronPreviewProvider` selection path once the interim SW is retired
  (ADR-0011).

## References

- SDD-0002; ADR-0006, ADR-0008, ADR-0011. PR #1968.
