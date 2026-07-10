---
id: ADR-0008
title: "Serve HTTP preview via cookieless capability URLs backed by a content-addressed, server-verified session store"
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
  adrs: [ADR-0006, ADR-0007, ADR-0009, ADR-0011]
supersedes: []
superseded_by: [ADR-0013]
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0008: Serve HTTP preview via cookieless capability URLs backed by a content-addressed, server-verified session store

## Status

Superseded by [ADR-0013](ADR-0013-sync-http-preview-as-layered-resources-with-atomic-incremental-revisions.md),
which keeps the cookieless capability-URL session model and replaces the
content-addressed manifest protocol with layered resources and atomic
incremental revisions.

## Context

An opaque preview (ADR-0006) served over HTTP needs a real URL so the iframe can
navigate and load subresources, but that URL must not inherit the authenticated
app session or same-origin privileges. The generated preview tree is produced
client-side and can be large; the server must publish it consistently and must not
trust client-supplied file metadata. The capability-URL model and the
content-addressed manifest are inseparable in the implementation (one session
manager does both), so they are recorded as a single decision.

## Problem

How does the server publish a client-generated preview tree behind an opaque,
unprivileged URL, consistently and without trusting the client blindly?

## Decision drivers

- The iframe needs a fetchable URL, but no authenticated capability.
- Do not trust client-provided hashes/sizes; publish atomically.
- Bound resource use (bytes, files, session count, idle time).

## Options considered

### Option 1: Cookieless capability URL + content-addressed, server-verified session

Mint an unguessable `crypto.randomUUID()` session; upload a manifest keyed by
hashes; the server re-computes SHA-256 for every blob, rejects mismatches, enforces
byte/file/session budgets, and swaps the active manifest atomically once all blobs
are present; the serving route is cookieless. Pros: real URL without app
capability; consistent, verified tree; bounded. Cons: session lifecycle + limits to
maintain; process-local.

### Option 2: Trust client file list and serve directly

Pros: simpler. Cons: server trusts client metadata; partial/torn trees; no budget.

### Option 3: Authenticated (cookie) preview URL

Pros: reuses auth. Cons: the opaque frame would carry app credentials — defeats the
isolation goal.

## Evidence

At `fix/opaque-iframe-external-media` @ `7da657a31`:
- `src/services/preview-session-manager.ts`: `createSession` (per-owner LRU),
  `stageManifest` (path normalization + traversal → 400, file-count/byte caps →
  413), `storeBlobs` (server-side SHA-256 re-hash, mismatch drop, 409 on manifest
  race, per-session + global byte budgets with eviction), atomic `promote`,
  `getFile` (active manifest only), idle-TTL sweeper.
- `src/routes/preview-session.ts`: cookieless capability route `/preview/{id}/*`,
  `Access-Control-Allow-Origin: *` (sound only because cookieless), hardening
  headers on every response including 404s.
- Client: `HttpPreviewProvider.js`, `fileManifest.js`.
- Tests: `preview-session-manager.spec.ts`, `preview-session.spec.ts`,
  `HttpPreviewProvider.test.js`, `fileManifest.test.js`.

## Decision

We will serve HTTP preview through unguessable, cookieless capability URLs backed
by a content-addressed session store that re-hashes every uploaded blob server-side,
enforces byte/file/session/TTL budgets, and swaps the active manifest atomically.

## Consequences

### Positive

- The opaque frame gets a real URL without any authenticated capability.
- The published tree is server-verified and consistent; resource use is bounded.

### Negative

- Session lifecycle, budgets and cleanup are additional server surface to maintain.

### Neutral

- The same session manager is reused by the Electron `app://` handler (ADR-0011).

## Risks

- Sessions are in-memory and process-local; a multi-instance HTTP deployment needs
  sticky sessions. Mitigation: documented; the client recreates a session on `404`.

## Validation

`preview-session-manager.spec.ts` covers re-hash/mismatch, 409 races, budgets,
atomic promote, traversal rejection and TTL; `preview-session.spec.ts` covers the
route (headers, 404/403, scriptable-type CSP).

## Follow-up work

- Optional persistent/shared session backend for multi-instance deployments.

## References

- SDD-0002; ADR-0006, ADR-0007, ADR-0009, ADR-0011. PR #1968.
