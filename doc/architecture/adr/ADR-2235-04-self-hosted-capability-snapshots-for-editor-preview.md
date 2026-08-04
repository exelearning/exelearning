---
id: ADR-2235-04
title: "Self-hosted capability snapshots for the editor preview (minimal subset)"
status: Accepted
date: 2026-07-22
tracking_issue: 2235
legacy_id: ADR-0004
deciders:
  - "@erseco"
related:
  prs: [1968]
  changes: []
  adrs: [ADR-2235-02, ADR-2235-05, ADR-2235-06]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Fable 5"
---

# ADR-2235-04: Self-hosted capability snapshots for the editor preview (minimal subset)

## Context

When a web/server user enables custom active content, the preview must switch to
an opaque-origin iframe served over a same-origin, cookieless, unguessable URL
(ADR-2235-02). The embedded-host case (ADR-2235-01) already had a client for exactly
this shape — `EmbeddedPreviewSnapshot` uploads a ZIP snapshot to a management
route and points a sandboxed iframe at a capability URL. The question is what the
**server** side should be for eXe's own routes.

PR #1968 built a full preview-session subsystem for this: layered
fixed/session/generated resources, atomic incremental revisions, a provider
abstraction, ETag/Range handling, and an Electron `app://` adapter. That is
powerful but is the operational surface ADR-2235-02 deliberately rejects for the
ordinary editor.

## Problem

What is the smallest server subsystem that safely serves an opaque preview
snapshot for the web/server editor, reusing the existing client, without adopting
PR #1968's session/revision/provider machinery?

## Decision drivers

- Reuse the `EmbeddedPreviewSnapshot` lifecycle unchanged — one client, two
  servers (embedded host and eXe itself).
- Minimal: full snapshot per refresh, no layers, no revisions, no providers, no
  protocol version.
- Capability = authorization: no cookies read, no cookies set on the serving path.
- Bounded resources: TTL, per-user quota, size caps, eviction, server-side sweep.

## Decision

Add a small subsystem (`src/routes/preview-snapshot.ts`,
`src/services/preview-snapshot-store.ts`), a deliberate minimal subset of
PR #1968's `preview-serving`/`preview-session-manager`:

- **Management routes** (`/api/preview-snapshot`, JWT-authenticated, CSRF-guarded
  by a `Sec-Fetch-Site: cross-site` rejection on top of the `SameSite=Lax` auth
  cookie): `POST` create/replace accepts the exact multipart ZIP wire format
  `EmbeddedPreviewSnapshot.replace()` already emits (`snapshot` + optional
  `previewId`) and returns `{ previewId, previewUrl }`; `DELETE` by `previewId`.
- **Serving route** (`GET /preview-snapshot/:id/:path*`, **no auth**): the
  ≥128-bit crypto-random, server-minted `previewId` is the only credential. It
  reads no cookies and never sends `Set-Cookie`. Strict traversal-safe path
  normalization (reusing the ported `content-path.util`), correct MIME mapping,
  `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, a restrictive
  `Referrer-Policy`, and — per [ADR-2235-06](ADR-2235-06-emit-sandbox-csp-on-every-scriptable-document-type.md)
  — a `sandbox`-first CSP on **every** scriptable type (HTML, XHTML, SVG, XML,
  PDF), so a directly opened capability URL stays opaque
  ([ADR-2235-05](ADR-2235-05-render-editor-preview-in-an-opaque-origin-sandbox.md)).
- **Lifecycle:** sliding 30-minute idle TTL renewed on management writes **only**
  (serving does not renew — an abandoned-but-open preview should die); an 8-hour
  absolute cap from creation; a per-user quota of 2 active snapshots with
  LRU eviction; a size cap following `MAX_UPLOAD_SIZE`; lazy expiry on every
  access plus a periodic server-side sweep. Replacement is atomic by construction
  (the new file map is fully materialized before a single synchronous swap; Bun
  runs JS on one thread, so no torn snapshot is ever served).
- **Absent where impossible:** the routes are registered only by the Bun server.
  Electron serves via its `app://` handler and static/PWA builds have no backend,
  so the transport is structurally absent there and the client's runtime
  resolution never offers it (ADR-2235-02's no-silent-fallback rule).

### Full-snapshot-per-refresh vs. PR #1968's incremental revisions

PR #1968 chose incremental revisions because *every* refresh in its model is a
server round-trip, so minimizing per-refresh bytes matters. Here the opaque
transport is engaged **only while a user has opted in**, and the default refresh
never touches the server at all. The three-way benchmark
(`test/benchmarks/preview/results/comparison.md`) shows the opaque snapshot upload
is ~400 KiB for the text fixtures — a payload paid only during opt-in — which does
not justify the revision-tracking machinery. Full snapshot per refresh is the
right trade for an opt-in, temporary transport.

## Consequences

### Positive

- One client contract for embedded hosts and the editor; no server-side drift.
- Small, auditable surface: a flat file map, a handful of headers, bounded memory.
- Capability-only serving mirrors the existing authless `/files/tmp/*` precedent.

### Negative

- Each opt-in refresh re-uploads the whole snapshot (bounded by the caps above).
- In-memory store: snapshots are lost on server restart (acceptable — the client
  re-creates on the next refresh; an unknown/expired id self-heals to a fresh id).

### Neutral

- The byte cap tracks `MAX_UPLOAD_SIZE`, so a deployment that raises the upload
  limit raises the snapshot cap consistently.

## References

- `src/routes/preview-snapshot.ts`, `src/services/preview-snapshot-store.ts`
- `src/utils/content-path.util.ts` (ported from PR #1968)
- `public/app/workarea/interface/elements/preview/EmbeddedPreviewSnapshot.js`
- `test/benchmarks/preview/results/comparison.md`
- [ADR-2235-02](ADR-2235-02-hybrid-preview-trust-boundary.md), [ADR-2235-05](ADR-2235-05-render-editor-preview-in-an-opaque-origin-sandbox.md), [ADR-2235-06](ADR-2235-06-emit-sandbox-csp-on-every-scriptable-document-type.md)
