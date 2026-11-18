---
id: ADR-348-03
title: "Cache the public export by Yjs document version and bound its cost, removing the unauthenticated bulk ZIP endpoint"
status: Proposed
date: 2026-07-09
tracking_issue: 348
legacy_id: ADR-0019
deciders:
  - "@erseco"
reviewers:
  - "@pabloamayab"
related:
  prs: [1425]
  changes: ["348-public-read-only-viewer-opaque-origin"]
  adrs: [ADR-348-01, ADR-348-02]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-348-03: Cache the public export by Yjs document version and bound its cost, removing the unauthenticated bulk ZIP endpoint

## Context

ADR-348-01 serves the public read-only viewer's content from the server: each request
under `/view/:publicViewId/_/*` must return a file from the project's HTML5 export.
Building that export is expensive — it reconstructs the Yjs document
(`reconstructDocument()`), runs the shared `Html5Exporter`, and zips the result
(`src/services/public-view-content.ts`, `buildHtml5PreviewExport()`).

Because the endpoint is **unauthenticated by design** (anyone with the link), two
concerns arise:

1. **Freshness vs. cost.** Rebuilding on every request is wasteful, but caching must
   invalidate exactly when the document changes. The obvious cache key,
   `projects.updated_at`, is wrong here: Yjs persistence writes only to the `yjs_*`
   tables (`saveFullState`, `saveIncrementalUpdate`, `upsertSnapshot` in
   `src/db/queries/yjs.ts`) and **never bumps `projects.updated_at`**, so a
   version-by-`updated_at` cache would serve stale content after an edit.
2. **Denial of service.** An unauthenticated build endpoint invites abuse: a
   thundering herd of first-time requests, and pathologically large exports consuming
   memory. Relatedly, an unauthenticated *bulk ZIP download* endpoint would be an easy
   amplification/abuse vector and must not exist by default.

## Problem

How should the public export be cached and cost-bounded so it stays fresh on every
edit yet cannot be rebuilt on every request, cannot thundering-herd the server, and
cannot be turned into an unauthenticated bulk-download amplifier?

## Decision drivers

- **Correctness/freshness:** the public view must reflect the latest persisted edit.
- **Efficiency:** avoid rebuilding an unchanged export; avoid redundant concurrent
  builds.
- **DoS resistance:** bound memory per export and the number of cached exports; no
  unauthenticated bulk download.
- **Testability:** the cache key resolver and export builder must be injectable so
  units do not run the full pipeline or hit the DB.

## Options considered

### Option 1: Rebuild the export on every request

- Pros: always fresh; no cache logic.
- Cons: a full `reconstructDocument` + export + zip per hit; trivially DoS-able on an
  unauthenticated route. Rejected.

### Option 2: Cache keyed by `projects.updated_at` (earlier approach, superseded)

An earlier iteration described the cache as keyed by `publicViewId:updated_at` (this
wording still survives in the `doc/architecture.md` §8.6 diagram text, to be reconciled
by PR #2149).

- Pros: simple, uses an existing column.
- Cons: **incorrect.** Yjs persistence never updates `projects.updated_at`, so edits
  would not invalidate the cache and the public view would serve stale content.
  Superseded by Option 4.

### Option 3: Keep an unauthenticated bulk ZIP export endpoint for the public

Expose the whole export as one downloadable ZIP with no auth.

- Pros: convenient "download the site" affordance.
- Cons: an unauthenticated, large-payload endpoint is an amplification/abuse vector; it
  is not needed for a read-only *viewer*. Rejected and explicitly documented as
  intentionally absent.

### Option 4 (chosen): Cache keyed by the Yjs document version + in-flight coalescing + hard size bounds; no public bulk ZIP

Key the in-memory cache on `public_view_id` + the effective persisted **Yjs document
version** (`getDocumentVersion()`), which increments on every persisted edit. Coalesce
concurrent first-time builds for the same key onto a single promise. Bound each export
by total unzipped bytes and file count, and cap the number of distinct cached projects
(LRU-style eviction). Keep the content route the only public surface; do not add an
unauthenticated bulk ZIP endpoint.

- Pros: fresh on every edit; one build per version even under concurrency; bounded
  memory; no bulk-download amplifier; DI-friendly.
- Cons: bespoke cache logic to maintain; per-IP rate limiting still delegated to the
  reverse proxy.

## Evidence

- Version-keyed cache (not `updated_at`): `src/services/public-view-content.ts` —
  `cacheKeyFor()` returns `${project.public_view_id}:${version}` where `version` comes
  from `resolveVersion` (default `getDocumentVersion(db, project.id)`). Module docstring:
  "The cache key intentionally does NOT use `projects.updated_at`… The Yjs document
  version increments on every persisted edit."
- Effective Yjs document version: `src/db/queries/yjs.ts` — `getDocumentVersion()`
  returns `max(snapshot_version, latest incremental update version)`; every persistence
  path writes a monotonic `Date.now()` version, so it strictly increases on edits and
  stays correct after compaction. Exported via `src/db/queries/index.ts`.
- In-flight coalescing: `src/services/public-view-content.ts` — `inFlight`
  `Map<key, Promise>`; `getFiles()` awaits the pending build instead of rebuilding.
- Cost bounds: `MAX_EXPORT_BYTES = 100 * 1024 * 1024`, `MAX_EXPORT_FILES = 5000`,
  `MAX_CACHE_ENTRIES = 32`; `buildFiles()` throws when an unzipped export exceeds the
  byte/file bounds; `getFiles()` evicts the oldest entry when the cache is full.
- No unauthenticated bulk ZIP: `src/routes/api/v1/export.ts` carries an explicit
  comment — "There is intentionally no unauthenticated public ZIP endpoint here… A
  public bulk download, if ever needed, must be a deliberate feature with explicit
  opt-in, auth and limits." The authenticated export API still requires owner access:
  `src/routes/api/v1/export.spec.ts` — "should still require auth for a
  publicly-visible project (no public bypass)" and "should return 403 for an
  authenticated non-owner even on a public project".
- Path-safe file lookup on the same route: `normalizePublicViewPath()` rejects
  traversal, encoded traversal, and NUL bytes; response is `Cache-Control: no-store`
  (the server holds the cache; clients do not).
- Dependency injection for tests: `configurePublicViewContent()` /
  `resetPublicViewContent()` swap `buildExport` and `resolveVersion`.
- Unit tests: `src/services/public-view-content.spec.ts` — "caches the unzipped export
  and rebuilds when the Yjs document version changes", "serves stale-free bytes after a
  persisted edit even when updated_at is unchanged", "coalesces concurrent builds for
  the same project into one", "throws when the export exceeds the file-count limit",
  plus the `normalizePublicViewPath` traversal cases. `src/db/queries/yjs.spec.ts`
  covers `getDocumentVersion`. `src/routes/pages.spec.ts` covers 404/500 behaviour of
  the content route.

## Decision

We will cache the public export in memory keyed by `public_view_id` + the effective
Yjs document version from `getDocumentVersion()` (never `projects.updated_at`, which
Yjs persistence does not touch). Concurrent first-time builds for the same version are
coalesced onto a single in-flight promise. Each export is bounded by total unzipped
bytes (100 MB) and file count (5000), and the number of cached projects is capped (32,
LRU eviction). We will **not** expose an unauthenticated bulk ZIP endpoint for the
public view; the server-side export API stays authenticated and owner-gated.

## Consequences

### Positive

- The public view always reflects the latest persisted edit, because the key tracks
  the Yjs document version, not `updated_at`.
- At most one build per (project, version), even under a burst of concurrent requests.
- Bounded memory: oversized exports are rejected and the cache count is capped.
- No unauthenticated bulk-download amplification surface.

### Negative

- The cache is per-process in memory; a multi-process/replicated deployment rebuilds
  per process (acceptable; still bounded and coalesced within a process).
- Bespoke caching, coalescing, and size-guard logic to maintain and test.

### Neutral

- Per-IP rate limiting is intentionally delegated to the reverse proxy / a dedicated
  middleware rather than implemented in the route.
- The 100 MB / 5000-file / 32-entry limits are constants that may need tuning per
  deployment.

## Risks

- **Cross-process staleness / memory pressure at scale.** In-process cache means each
  worker holds its own copy; the LRU cap bounds this. If a deployment needs a shared
  cache, a follow-up can back it with a shared store. Medium/low.
- **Legitimate very large courses hitting the bounds.** An export over 100 MB or 5000
  files is rejected (surfaced as a 500 on the content route). The limits can be raised;
  such sizes are unusual for a read-only web export. Low.
- **Doc drift.** `doc/architecture.md` §8.6 still says "cached by updated_at"; the code
  is authoritative (version-keyed). To be reconciled by PR #2149. Low.

## Validation

- `src/services/public-view-content.spec.ts` and `src/db/queries/yjs.spec.ts` are
  green, including the "stale-free after a persisted edit even when updated_at is
  unchanged" and "coalesces concurrent builds" cases.
- `src/routes/api/v1/export.spec.ts` confirms no public bypass on the authenticated
  export API.
- Manual: editing a shared project changes `getDocumentVersion()` and the next
  `/view/:publicViewId/_/index.html` reflects the edit without a server restart.

## Follow-up work

- Add per-IP rate limiting at the reverse proxy / middleware for `/view/*`.
- Consider a shared/replicated cache if horizontal scaling makes per-process rebuilds
  costly.
- Reconcile the `doc/architecture.md` §8.6 wording ("updated_at") with the
  version-keyed implementation (PR #2149).
- If a public bulk download is ever wanted, design it as a deliberate opt-in feature
  with auth and limits.

## References

- Issue #348 — public read-only URL.
- PR #1425 — implementation.
- the change design — Public Read-Only Viewer with Opaque-Origin Untrusted-Content Isolation.
- ADR-348-01 — opaque-origin isolation of the served content.
- ADR-348-02 — public view identifier and independent enablement flag.
- `src/services/public-view-content.ts`, `src/db/queries/yjs.ts`,
  `src/routes/api/v1/export.ts`, `src/routes/pages.ts`.
- `doc/architecture.md` §8.6.
