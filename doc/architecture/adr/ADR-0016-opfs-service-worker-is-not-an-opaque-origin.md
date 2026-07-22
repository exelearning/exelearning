---
id: ADR-0016
title: "OPFS plus a Service Worker does not create an opaque origin (static/PWA limit)"
status: Proposed
date: 2026-07-22
deciders:
  - "@erseco"
reviewers: []
related:
  issues: []
  prs: [1968]
  sdds: []
  adrs: [ADR-0002, ADR-0006]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Fable 5"
---

# ADR-0016: OPFS plus a Service Worker does not create an opaque origin (static/PWA limit)

## Status

Carried (historical). Retained from PR #1968's reasoning as the evidence behind
the static/PWA concession in [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md).

## Context

The hybrid trust boundary (ADR-0002) can serve an opaque preview snapshot in
web/server mode because a backend mints an unguessable, cookieless capability URL
and the browser gives the framed document an opaque origin (no `allow-same-origin`;
see [ADR-0006](ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md)).
Static bundle, PWA, and PHP-WASM deployments have **no backend**. The natural
question is whether a purely client-side stack — the Origin Private File System
(OPFS) for storage plus a Service Worker to synthesize responses — could
reproduce the opaque-origin boundary without a server.

## Problem

Can a static/PWA build isolate enabled active content in an opaque origin using
OPFS + a Service Worker, or must it accept a same-origin consent path?

## Evidence

- A Service Worker can only intercept and synthesize responses **for its own
  registration scope**, which is the app's own origin. A response it fabricates is
  therefore served from — and framed as — the **same origin** as the editor. The
  Service Worker cannot mint a different or opaque origin; that is a property of
  how the browser assigns origins, not of where the bytes came from.
- OPFS is an **origin-scoped** storage API. Data placed in OPFS belongs to the
  app origin and is reachable by any same-origin script. Reading a snapshot out of
  OPFS and framing it does not change the framed document's origin.
- The only client-side ways to obtain a non-same-origin/opaque framed document are
  a sandboxed iframe **without** `allow-same-origin` whose content is delivered
  such that it stays opaque, or a genuinely cross-origin URL. A sandboxed frame
  can be made opaque, but there is no backend to serve its resources over a
  capability URL, and `srcdoc`/`blob:`-based transports either inherit the app
  origin or cannot carry a multi-file package with working relative references.

## Decision

Treat OPFS + Service Worker as **not** producing an opaque origin. Static/PWA/
PHP-WASM builds therefore fall to ADR-0002's `consented-same-origin` row: when a
user enables custom active content there, the code runs same-origin with the
editor, as a documented residual risk. No client-only mechanism is claimed to
isolate it. This matches the limit PR #1968 also accepted (a trusted same-origin
Service Worker in privileged/static contexts).

## Consequences

### Positive

- Honest boundary: the product does not claim isolation it cannot enforce.
- The enable dialog in static/PWA explains the residual risk plainly, so the
  consent is informed.

### Negative

- Static/PWA users who enable custom active content accept the same-origin risk;
  there is no opaque path for them without a backend.

### Neutral

- If a future browser API grants client-only code an opaque, capability-served
  origin for multi-file packages, this record should be revisited.

## References

- `public/app/utils/previewContentPolicy.js` — `resolvePreviewTransport` maps the
  backend-less `static` runtime to `CONSENT_SAME_ORIGIN`.
- [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md), [ADR-0006](ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md)
- [Core PR #1968](https://github.com/exelearning/exelearning/pull/1968)
