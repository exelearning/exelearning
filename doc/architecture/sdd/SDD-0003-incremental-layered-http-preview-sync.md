---
id: SDD-0003
title: "Incremental layered HTTP preview sync (protocol v2)"
status: Draft
date: 2026-07-11
authors:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  adrs: [ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0013, ADR-0015]
  sdds: [SDD-0002]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# SDD-0003: Incremental layered HTTP preview sync (protocol v2)

## Status

Draft

> **Note — two references predate [ADR-0015](../adr/ADR-0015-opaque-http-preview-in-privileged-contexts-and-trusted-static-service-worker.md).**
> The "Non-goals" mention of `SrcdocPreviewProvider` reflects the transport set
> at the time of writing; ADR-0015 **removed** `srcdoc` as an authored-content
> transport (standalone static/PWA now uses the same-origin
> `static-service-worker` transport, a trusted-content mode). And editor
> activation is the normalized **`previewHttp`** block
> (`managementBaseUrl`/`servingBaseUrl`/`managementHeaders`/`managementQuery`),
> **not** `previewTransport: 'http' + previewBasePath` (`previewBasePath` was
> never implemented). The design body below is preserved as the original record
> and is not rewritten; the wire contract in
> [preview-serving-contract.md](../../development/preview-serving-contract.md) is
> authoritative.

## Summary

Replace the HTTP preview's full-manifest/content-addressed sync (protocol v1,
ADR-0008) with a three-layer incremental model (ADR-0013): fixed installation
resources are served from the host's installed editor distribution and never
uploaded; project assets upload once per session under identity the project
model already stores; generated documents are published as atomic incremental
revisions. The client stops regenerating/hashing the world per refresh and
gains a lossless refresh queue. One wire contract
(`doc/development/preview-serving-contract.md`, v2) serves the Bun server,
Electron `app://`, and the five platform plugins.

## Problem statement

Every debounced preview refresh today costs `O(total project size)`: full
export-map regeneration (all pages re-rendered, every asset blob re-read from
the Cache API and copied), SHA-256 hashing of every file client-side, full
manifest serialization, and server-side re-hash of uploads. Installation
libraries and official theme/iDevice files are uploaded into every session.
A refresh arriving while one is in flight is silently dropped
(`previewPanel.js:931`), losing the latest edit until the next event.

## Goals

1. A text edit performs work proportional to the invalidated documents plus new
   assets — never to total media size.
2. Unchanged project assets upload at most once per session; fixed installation
   resources transfer zero bytes.
3. No SHA-256 sweep of the file set on any refresh, client or server.
4. Revisions publish atomically; concurrent refreshes never lose the latest
   state; revisions are strictly monotonic.
5. Identical protocol semantics on the Bun server, Electron `app://`, and the
   Moodle/WordPress/Omeka/Nextcloud/Procomún plugins.
6. All ADR-0006/0009 isolation invariants preserved (opaque origin, sandbox
   CSP on every scriptable type, capability URLs, budgets, TTL, path safety).

## Non-goals

- Static/PWA builds, GitHub Pages, `SrcdocPreviewProvider`, the static Service
  Worker — untouched (shared code changes must be additive).
- Global cross-user deduplication, persistent preview storage, CDN serving,
  WebContainers/php-wasm, new domains or ports.
- Decoupling per-page navigation markup (follow-up in ADR-0013).

## Current state

See ADR-0013 "Context/Evidence" for file:line references. Key points: the
exporter pipeline (`Html5Exporter.generateForPreview`) mixes three provenance
classes into one `Map<path, ArrayBuffer>`; asset SHA-256 already exists in Yjs
metadata but is stripped by `BrowserAssetProvider.listAssetMetadata`; Yjs
observers already classify change scope but `previewPanel` discards it; plugin
session stores are stubs (Procomún implements v1, unused by any editor).

## Proposed design

### Client pipeline (per refresh)

```
Yjs change events
  → PreviewInvalidationTracker (classify + accumulate dirty scope)
  → debounce 500 ms → PreviewRefreshQueue (single-flight + pendingRefresh)
  → LayeredPreviewGenerator (regenerate dirty documents; reuse cached clean ones)
  → decorate changed HTML (previewContentDecorators)
  → diff against previous published documents (byte/string equality)
  → HttpPreviewProvider v2:
      upload new asset keys (once) → POST …/assets
      POST …/revisions { baseRevision, nextRevision, writes, deletes, assetRefs, fixedRefs }
  → iframe reload preserving current page
```

### Server session state (all hosts)

```
PreviewSession {
  id: uuid, ownerUserId, revision: number,
  documents: Map<path, bytes>,          // generated layer, latest bytes per path
  assetRefs: Map<path, assetKey>,       // active revision's asset map
  fixedRefs: Map<path, fixedResourceId>,// active revision's fixed map
  assets: Map<assetKey, bytes>,         // session-lifetime, immutable per key
  createdAt, lastAccessAt
}
```

Serving resolution: `documents → assetRefs→assets → fixedRefs→manifest → 404`
(contract §B). Revision application buffers everything, re-validates, then
swaps `documents`/`assetRefs`/`fixedRefs`/`revision` in one synchronous block
(same await-then-mutate discipline as v1 `storeBlobs`).

## User experience

No visible UI changes. Preview refreshes become perceptibly immediate for
ordinary edits on media-heavy projects; rapid typing coalesces without losing
the final state; the currently viewed page is preserved across refreshes (as
today, via `?v=` re-navigation).

## Technical design

### 1. Fixed-resource manifest (build)

`scripts/build-resource-bundles.js` gains a step that emits
`public/bundles/preview-fixed-resources.json` (schema in contract §"The
fixed-resource manifest") enumerating: BASE_LIBS + every LIBRARY_PATTERNS file,
PDF.js, base iDevice `export/` files (`idevices/{type}/{file}` ids), base theme
files (`theme:{name}/{relpath}` ids), `content/css/base.css`,
`content/img/exe_powered_logo.png`, and `fonts/global/{id}/{file}`. The static
bundle build copies it into the distribution. Ids are derived from the same
lists the exporter/ResourceFetcher already use, so client-emitted ids and the
manifest agree by construction.

### 2. Layered generation (shared exporter, additive)

New `Html5Exporter.generateForPreviewLayered(opts)` (exposed as
`SharedExporters.generatePreviewLayered`) reuses the existing pipeline but:

- **Fixed refs instead of bytes.** Steps 4–9.5 record
  `fixedRefs[previewPath] = fixedResourceId` when the ResourceProvider resolved
  the file from an installation-immutable source; otherwise the bytes stay in
  `documents` (user/site themes, user iDevices, mutated `base.css`,
  `libs/common_i18n.js`, `libs/elpx-manifest.js`). The ResourceProvider
  interface gains optional provenance-aware variants (implemented by
  `BrowserResourceProvider`/`ResourceFetcher`, which know which source — user
  map, IndexedDB user store, site bundle, base bundle, per-file fallback —
  satisfied each fetch). Rule: *fixed iff resolved from the base bundles or
  another provably base source; every doubt → documents.*
- **Asset refs instead of blobs.** Step 10 uses asset **metadata only**
  (`listAssetMetadata` extended to expose the existing Y.Map `hash`) and emits
  `assetRefs[exportPath] = "{assetId}@{hash.slice(0,16)}"`. No blob is read at
  generation time. The provider exposes `getAssetBytes(assetId)` for the sync
  engine to load **only** assets the server is missing. Assets without a hash
  (defensive) fall back to on-demand hashing of that one asset, never a sweep.
- **Dirty-scope regeneration.** Accepts
  `{ dirtyPages: Set<pageId> | 'all', previousDocuments }`: with a page-scoped
  set it re-renders only those pages (plus `index.html` when the first page is
  affected) and copies every other page's entry from `previousDocuments`;
  `search_index.js` regenerates when any page content changed; global inputs
  (nav-affecting structure, theme, metadata, LaTeX/library detection changes)
  force `'all'`. `buildPageList` still runs each refresh (cheap structure
  walk); `preprocessPagesForExport` is restricted to the pages being rendered.
- `generateForPreview` (v1 full map) remains byte-identical for
  srcdoc/static/screenshot consumers.

### 3. Invalidation classifier (client)

New `public/app/workarea/interface/elements/preview/previewInvalidation.js`:
subscribes once (from `previewPanel.subscribeToChanges`) to the existing
bridge observers and accumulates a `DirtyScope` between refreshes:

| Signal (existing observer) | Scope effect |
|---|---|
| `navigation.observeDeep` path `[i,'blocks',…]` content-only | `dirtyPages += pageId` |
| structure add/delete/move/rename (shallow paths) | `all` (nav embedded per page) |
| `metadata.observe` key `theme`, `globalFont`, `addSearchBox`, … (explicit key→scope map) | `all` |
| `metadata.observe` non-visual keys (e.g. save bookkeeping) | ignore |
| `assetsMap.observe` add/update(hash change)/delete | `dirtyPages += referencing pages` if determinable, else `all`; new/changed keys noted |
| `themeFilesMap.observe` (user theme edits) | `all` |
| anything unclassified | `all` |

`'all'` is the safe default; classification only ever *narrows* work, and the
byte-diff before upload guarantees correctness regardless of scope precision.

### 4. Refresh queue (client)

`previewPanel.refresh()` becomes single-flight with coalescing:

```js
async refresh() {
  if (this.isLoading) { this._pendingRefresh = true; return; }
  this.isLoading = true;
  try {
    do {
      this._pendingRefresh = false;
      const scope = this._invalidation.consume();   // atomically take dirty scope
      await this._refreshOnce(scope);
    } while (this._pendingRefresh);
  } finally { this.isLoading = false; }
}
```

- The dirty scope is consumed atomically per round; an edit landing mid-round
  re-marks `_pendingRefresh` and its scope survives for the next round.
- Revisions are monotonic by construction (single in-flight sync; the queue
  never runs two `_refreshOnce` concurrently).
- On failure of a round the accumulated scope is merged back so nothing is
  lost; the error surfaces as today.

### 5. HttpPreviewProvider v2 (client transport)

- `prepare()` requires `protocolVersion === 2` from create-session (else
  `PreviewProviderError` — no fallback).
- Maintains `uploadedAssetKeys: Set` (cleared on session recreation). Before a
  revision: `missing = assetRefs values − uploadedAssetKeys`; batch-uploads
  those (`recommendedBatchBytes`-bounded multipart; an oversized asset ships
  alone), then marks them uploaded.
- Publishes the delta: writes = documents whose decorated bytes differ from the
  last **acknowledged** revision's (string comparison for HTML/text, byte
  comparison otherwise), deletes = vanished paths, plus full ref maps.
- Error recovery: `409 revision-conflict` → resend full document snapshot at
  `currentRevision`; `422 missing-assets` → upload listed keys, retry once;
  `422 unknown-fixed-resources` → demote those paths to document writes, retry
  once; `404` → recreate session, clear `uploadedAssetKeys`, full snapshot.
- The decorated-output cache is keyed per generated path; decoration only runs
  for regenerated documents. PDF.js is no longer copied into the session — the
  generator emits `fixedRefs` for `libs/pdfjs/*` whenever any document
  references a PDF, and `decorateForHttp` keeps the session-relative
  `pdfjsBase` (which now resolves through the fixed layer).

### 6. Server (core reference implementation)

`src/services/preview-session-manager.ts` — rewritten store per "Proposed
design" (v1 manifest/CAS code removed): `uploadAssets`, `applyRevision`,
`getFile` (three-layer resolution + Range/ETag inputs), unchanged
lifecycle/limits/TTL/LRU machinery. New
`src/services/preview-fixed-resources.ts` loads and caches the manifest and
resolves ids to bytes under `public/` with containment checks.
`src/routes/preview-session.ts` — routes per contract §A/§B; serving adds
tiered `Cache-Control`, `ETag`/`If-None-Match`, and single-range `206/416` for
assets. Headers and CSP unchanged (`previewSandbox.ts` untouched).

### 7. Electron

`src/services/electron-preview-handler.ts` extends its regex router with
`/assets` and `/revisions`, reusing the shared manager and a
`dist/static`-rooted fixed-resource resolver; Range slicing implemented in the
handler. Packaging fixes ship in the same change: `make package` runs
`bundle:electron-preview`, and the electron-builder `files` allowlist gains
`app/preview/**` (recon found packaged installers currently omit the handler
entirely). The stale `scripts/build-electron-preview.ts` comment is corrected.

### 8. Plugins

Each host implements contract v2 with framework-native storage
(file-backed store + staging dir + atomic pointer swap; see contract §"Per-host
adapter notes"), authenticated management (Moodle sesskey / WP REST
permission_callback / Omeka CSRF / Nextcloud attributes / Procomún
better-auth), TTL cleanup (scheduled task / WP-Cron + request-time checks /
cron job / background job / sweeper), and the shared conformance vectors.
Procomún replaces its v1 port. Editor activation
(`previewTransport: 'http'` + `previewBasePath`) stays a per-host follow-up
switch — serving contract first, flip later.

## Data model

No database changes. Session state is per-process memory (core, Electron,
Procomún) or host temp storage (PHP plugins). The fixed-resource manifest is a
build artifact, not runtime state.

## Migration and compatibility

Protocol v1 was never consumed by a shipped host editor (plugins stubbed,
Procomún unwired); PR #1968 is unmerged. v1 code paths are therefore removed
outright — no dual protocol, no version negotiation beyond the
`protocolVersion: 2` assertion. `fileManifest.js` is deleted with its tests;
`generateForPreview` keeps serving srcdoc/static unchanged.

## Security and privacy

All v1 invariants carried forward (contract §"Security invariants" items 1–5)
plus new ones (items 6–8): manifest-gated fixed resolution (unknown ids never
touch the filesystem), atomic revision observation, immutable asset keys.
Trust model change: the server no longer re-hashes uploads — asset identity is
declared by the authenticated session owner and scoped to their own session
(documents were never hashed in v1 either); forged identity can only corrupt
the forger's preview. Path validation (`normalizeContentPath`) applies to every
path in writes/deletes/ref maps and at serve time. Capability-URL,
budget, TTL and header requirements unchanged.

## Accessibility

No changes to rendered content or UI semantics.

## Internationalization

`libs/common_i18n.js` is generated per language and rides the document layer
(re-uploaded only when it changes). No new user-facing strings besides existing
error surfaces (which reuse `_()`).

## Performance

Targets (measured by `test/benchmarks/preview/`, baseline vs after, scenarios
A–G from the work brief): ≥80 % refresh-time reduction for simple edits on the
medium fixture; ≥90 % transferred-byte reduction for text edits; zero bytes for
unchanged assets and fixed resources; refresh time independent of large-media
size; no per-refresh SHA-256. Complexity:
`O(dirty documents + new assets)` per refresh; worst case (structural change)
regenerates all page HTML but still transfers only changed bytes and never
re-reads assets.

## Testing strategy

- **Unit (client, Vitest):** invalidation classifier scope table; refresh-queue
  coalescing (mid-flight edit, failure merge-back, monotonic revisions);
  provider v2 (delta computation, asset-key set, 409/422/404 recovery,
  batching); layered generator (fixed/asset/document classification incl.
  user-theme shadowing, dirty-scope reuse, byte-identical `generateForPreview`
  for srcdoc).
- **Unit (server, bun test):** store (revision ordering, conflicts, atomic
  swap under concurrent reads, asset immutability, budgets declared+actual,
  TTL/LRU), fixed-resource resolver (containment, unknown id), route handlers
  (status codes, headers per tier, ETag/Range, scriptable CSP).
- **Security:** traversal (raw/encoded/double-encoded/backslash/NUL/absolute),
  scriptable SVG/XML/XHTML from session *and* fixed layers, cross-session
  isolation, expired/nonexistent capability, unauthenticated management, false
  declared sizes, incomplete deltas, stale revisions, duplicate asset identity
  with different declared bytes.
- **Integration:** full lifecycle incl. session recreation and conflict
  recovery; Electron handler through `Request` objects.
- **E2E (Playwright):** existing opaque-preview, external-media,
  search-preview-navigation, latex, interactive-video, image-gallery,
  beforeafter, page-properties, teacher-mode, preview-new-tab suites must pass;
  new spec asserting a rapid-edit burst converges to the final state.
- **Conformance vectors:** `test/fixtures/preview-contract/` consumed by host
  test suites.

## Rollout plan

1. Core: manifest build step + server store/routes + client pipeline + tests
   (one PR on `feat/incremental-preview-revisions`, stacked on #1968).
2. Electron adapter + packaging fix.
3. Plugin adapters (independent PRs per repo), Procomún v1 port replaced.
4. Editor activation per host (config flip) after host-side validation.

## Risks and mitigations

See ADR-0013 "Risks" (misclassification, torn PHP revisions, coalescing,
manifest drift). Additional implementation risks: exporters bundle staleness in
E2E (`make bundle` before running — documented in the benchmark README);
Electron `protocol.handle` FormData behavior differences (covered by handler
integration tests through real `Request` objects).

## Open questions

- Should the core server adopt asset bytes from `FILES_DIR/assets/{uuid}/`
  instead of client upload when available? (Follow-up; contract already allows
  it as an optimization since `alreadyStored` short-circuits.)
- Disk-backed Electron store threshold (follow-up in ADR-0013).

## ADRs required or referenced

ADR-0013 (decision this SDD implements); ADR-0006/0007/0009/0011/0012
(preserved constraints); ADR-0008 (superseded protocol).

## Evidence

Reconnaissance of 2026-07-11 across the seven repos (file:line references in
ADR-0013 "Evidence"); baseline benchmark results in
`test/benchmarks/preview/results/baseline.*`.

## Acceptance criteria

- All Goals 1–6 demonstrably hold; benchmark report shows the Performance
  targets or documents measured reasons where a target is unrealistic.
- `make fix`, `make test-unit`, `make test-integration`, `make test-e2e` green;
  patch coverage ≥ 90 %.
- Existing preview E2E suites pass unmodified (no test deletions/skips).
- Contract v2 doc, this SDD, ADR-0013, and per-host mirror docs consistent.

## Implementation checklist

- [ ] `preview-fixed-resources.json` build step + static-bundle copy
- [ ] ResourceProvider provenance + asset-hash plumbing
- [ ] `generateForPreviewLayered` + dirty-scope regeneration
- [ ] Invalidation classifier + refresh queue rewrite
- [ ] HttpPreviewProvider v2 + recovery paths
- [ ] Server store + routes v2 (v1 removed) + fixed resolver
- [ ] Electron router v2 + Range + packaging fix
- [ ] Conformance vectors + security suites
- [ ] Plugin adapters ×5 + mirror docs
- [ ] Benchmarks after + reports

## References

- `doc/development/preview-serving-contract.md` (canonical wire contract v2)
- `doc/development/preview-architecture.md`
- `lms-untrusted-content-security-paper` (threat model)
- PR #1968; ADR-0013
