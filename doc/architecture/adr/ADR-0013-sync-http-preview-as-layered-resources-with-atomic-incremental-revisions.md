---
id: ADR-0013
title: "Sync the HTTP preview as layered fixed/asset/document resources with atomic incremental revisions"
status: Proposed
date: 2026-07-11
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0002, SDD-0003]
  adrs: [ADR-0006, ADR-0007, ADR-0009, ADR-0011, ADR-0012]
supersedes: [ADR-0008]
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# ADR-0013: Sync the HTTP preview as layered fixed/asset/document resources with atomic incremental revisions

## Status

Proposed

## Context

ADR-0008 shipped the opaque HTTP preview as a cookieless capability URL backed by
a per-session **content-addressed store**: every debounced refresh regenerates
the complete export file map client-side, SHA-256-hashes every file, POSTs a
full manifest, and the server re-hashes every uploaded blob before an atomic
manifest swap. That design is correct but makes a one-word edit cost
`O(total project size)`: at `feat/incremental-preview-revisions` (branched from
`fix/opaque-iframe-external-media`), `Html5Exporter.generateForPreview`
(`src/shared/export/exporters/Html5Exporter.ts:559-812`) rebuilds every page,
re-reads **every project asset blob** from the Cache API
(`Html5Exporter.ts:817-842`, `BrowserAssetProvider.ts:420-465`), and re-copies
~1.5 MB of installation libraries per refresh; `fileManifest.js:36-44` then
hashes all of it. Three facts make an incremental model cheap to build:

1. Assets already carry a stable SHA-256 in the Yjs assets Y.Map, computed once
   at ingestion (`AssetManager.js:683-702`) — per-refresh hashing re-derives
   identity that already exists.
2. Installation resources (libraries, base themes, base iDevice runtimes,
   PDF.js) are byte-identical for every project on a host and already exist on
   disk in every deployment (server `public/`, Electron `dist/static`, plugins'
   installed static editor).
3. Yjs observers already distinguish page-content, structure, theme, metadata
   and asset changes (`YjsProjectBridge.js:676,780-846,1461,1494-1546`) — the
   preview simply discards that classification today.

No shipped host consumes protocol v1: the plugin session stores are stubs
(Moodle/WP/Omeka/Nextcloud) or unwired (Procomún implements v1 but its editor
never activates the HTTP transport), and ADR-0008 is still Proposed on the
unmerged PR #1968 line, so a clean replacement needs no migration path.

## Problem

How should the client publish a preview tree to the capability-URL session so
that a small edit transfers and processes work proportional to the change — not
to the total project size — without weakening the isolation guarantees of
ADR-0006/0009 or the capability-session model of ADR-0008?

## Decision drivers

- A text edit must not read, hash, or upload unchanged media or installation
  files; refresh cost should approach `O(invalidated documents + new assets)`.
- Preserve every v1 security invariant: opaque origin, sandbox-first CSP on all
  scriptable types, authless capability serving, path validation, budgets, TTL,
  atomic publication.
- One protocol for all hosts (Bun server, Electron `app://`, five plugins) —
  implementable without new cookieless primitives on any of them (Moodle has no
  authless static-file route for a separate fixed-resource origin).
- Generated HTML must stay transport-agnostic (relative URLs) so real exports
  and the srcdoc/static transports are untouched.
- Prefer identity the project model already stores over recomputed
  cryptographic hashes; prefer per-session state over a global CAS.

## Options considered

### Option 1: Three layers + serving-route resolution + incremental revisions (chosen)

Split the preview into (1) **fixed installation resources**, never uploaded,
resolved by the serving route through a build-generated manifest via a
per-revision `fixedRefs` map; (2) **session project assets**, uploaded once per
session under an immutable `{assetId}@{hash16}` key taken from existing Y.Map
metadata, mapped per revision via `assetRefs`; (3) **generated documents**,
applied as atomic `baseRevision → nextRevision` deltas (`writes`/`deletes`) with
`409` conflict recovery by full document snapshot. Serving resolves
`documents → assetRefs → fixedRefs → 404`. Pros: removes all per-refresh
hashing and asset I/O; zero bytes for fixed/unchanged resources; relative URLs
unchanged (the `theme/*` flattened namespace maps per session); single authless
route per host; caching tiered per layer. Cons: the server trusts the
authenticated owner's declared asset identity (scoped to their own session);
two ref maps of bookkeeping per revision.

### Option 2: Keep the v1 manifest protocol, optimize only generation

Cache generated output client-side and skip unchanged uploads (v1 already
diffs), avoiding wire changes. Pros: smallest diff. Cons: still hashes every
file and serializes a full manifest per refresh; still uploads installation
files once per session per host; server still re-hashes uploads; plugins still
must implement the CAS store. Fails driver 1.

### Option 3: Serve fixed resources from separate versioned URLs (`/preview-resources/{version}/…`) rewritten into the HTML

Pros: cross-session shared caching; no manifest lookup in the serving route.
Cons: requires rewriting every relative reference in generated HTML/CSS
(divergence from export output; fragile for CSS `url()` and runtime `fetch()`),
a new authless static route with CORS on every host (Moodle lacks one), and
`theme/*` cannot be rewritten 1:1 because the export flattens the selected
theme into one namespace. Fails drivers 3 and 4.

### Option 4: Server-side generation from the Yjs snapshot

Pros: no upload at all. Cons: inverts the client-is-source-of-truth
architecture (§7.1), requires full exporter parity server-side on five PHP/TS
hosts, and re-generates everything per edit anyway. Rejected outright.

## Evidence

- Cost centers and layer composition: reconnaissance at
  `feat/incremental-preview-revisions` (2026-07-11) — full-map regeneration
  `Html5Exporter.ts:559-812`; per-refresh asset reads
  `BrowserAssetProvider.ts:420-465`; client hashing `fileManifest.js:36-44`;
  server re-hash `preview-session-manager.ts:311-374`; lost-refresh drop
  `previewPanel.js:931`.
- Existing asset identity: `AssetManager.js:559-575` (Y.Map metadata incl.
  `hash`), `:683-702` (hash computed once at ingestion), `:777-781`
  (content-derived ids); the hash is stripped before reaching exporters
  (`BrowserAssetProvider.ts:300-347`) — plumbing it through is the only new
  requirement.
- Fixed resources already deployed per host: server static plugin
  `src/index.ts:540-546` and versioned immutable routes `src/index.ts:374-442`;
  Electron static handler `app/main.js:132-207`; plugins ship the static editor
  distribution. Bundle build already enumerates and hashes the fixed sets
  (`scripts/build-resource-bundles.js`).
- Host state: Procomún implements v1 (`apps/api/src/services/preview-session-store.ts`,
  commit `dc33805c`, feature branch only); Moodle/WP/Omeka/Nextcloud serving
  controllers are stubs with absent stores; no host wires
  `previewTransport: 'http'` into its editor config yet.

## Decision

We will replace the v1 content-addressed manifest protocol with **preview
serving contract v2** (`doc/development/preview-serving-contract.md`):

1. A build-generated **fixed-resource manifest** gates everything the serving
   route may resolve outside the session; fixed resources are never uploaded
   and are classified by fetch provenance, never by name.
2. **Session assets** upload once under an immutable, regex-validated
   `{assetId}@{hashPrefix}` key derived from existing Y.Map metadata; the
   server never hashes preview bytes.
3. **Generated documents** are published as strictly monotonic, atomically
   swapped revisions (`baseRevision`/`nextRevision`/`writes`/`deletes` plus
   full `assetRefs`/`fixedRefs` maps); conflicts return `409` and recover via a
   document-layer snapshot without re-uploading assets.
4. Serving resolves `documents → session assets → manifest-gated fixed files`,
   with tiered `Cache-Control` (`no-store` / `no-cache`+`ETag` /
   `private, max-age=31536000`), `Range` support on assets, and the unchanged
   hardening headers + sandbox-first CSP on every scriptable type.
5. The cookieless capability-URL session model, budgets, TTL, per-user LRU and
   path validation of ADR-0008 are carried forward unchanged; v1 wire code is
   removed (no dual protocol).

## Consequences

### Positive

- Refresh work and transfer become proportional to the edit: no per-refresh
  SHA-256 sweeps (client or server), no asset blob reads for unchanged media,
  zero bytes for installation resources, `304`/`206` semantics for assets.
- One wire contract for server, Electron and all five plugins, implementable on
  each host's existing authless primitive; PHP hosts get an explicit
  staging + pointer-swap recipe for atomicity.
- Session-expiry recovery is cheaper and self-healing (snapshot of small
  documents + re-upload of only server-missing assets).

### Negative

- The server no longer verifies content hashes; asset identity is trusted from
  the authenticated owner (blast radius: the owner's own preview session —
  documents were never hashed in v1 either).
- Two ref maps and a revision counter are new per-session state every host must
  publish atomically.

### Neutral

- The srcdoc/static transports keep consuming the full in-memory file map; the
  layered pipeline is additive in the shared exporter.
- Sessions remain process-local (sticky sessions for multi-instance, as in
  ADR-0008).

## Risks

- **Misclassification of user content as fixed** would serve installation bytes
  in place of author bytes. Mitigation: provenance-only classification at the
  ResourceProvider seam, manifest enumerates base resources only, and tests
  assert a user theme/iDevice shadowing an official name rides the session.
- **Torn revisions on file-backed (PHP) stores.** Mitigation: contract mandates
  stage-then-atomic-pointer-swap and conformance vectors exercise concurrent
  reads during publication.
- **Coalescing bugs** (lost edits) become more visible with cheap refreshes.
  Mitigation: the client refresh queue is redesigned (single-flight +
  `pendingRefresh` rerun, monotonic revisions) with unit tests for the
  mid-flight-edit case (`previewPanel.js:931` today drops it).
- **Fixed-manifest drift** between client bundle and host distribution after a
  partial upgrade. Mitigation: `422 unknown-fixed-resources` demotes the
  affected paths to document writes and retries (correct, marginally larger
  delta).

## Validation

- Unit: layer classification, asset-key validation/immutability, revision
  ordering/conflicts, ref-map validation, path sanitization, refresh-queue
  coalescing, tiered cache headers.
- Integration: create/upload/apply/serve/delete lifecycle, 409 recovery,
  missing-asset renegotiation, Range/ETag, expired-session recreation.
- Security: traversal (raw/encoded/backslash/NUL), scriptable SVG/XML/XHTML CSP
  from both session and fixed layers, capability isolation between sessions,
  fixed-manifest gating (unknown ids never touch the filesystem), budget
  enforcement on declared and actual bytes.
- E2E: existing opaque-preview/external-media/navigation suites must pass
  unchanged; benchmark scenarios (text edit, new asset, large-video project,
  structural change, theme change, rapid typing) measured before/after in
  `test/benchmarks/preview/`.

## Follow-up work

- Optional disk-backed session store for Electron (assets currently pin main-
  process RAM within existing budgets).
- Optional server-side asset adoption (core server already stores project
  assets under `FILES_DIR/assets/{uuid}/`; a host could satisfy an asset upload
  from local storage without a client round-trip).
- Navigation-fragment decoupling to shrink structural-change invalidation
  (today the full navigation is embedded in every page document).

## References

- `doc/development/preview-serving-contract.md` (canonical contract v2)
- SDD-0003 (design); SDD-0002; ADR-0006, ADR-0007, ADR-0009, ADR-0011,
  ADR-0012; supersedes ADR-0008. PR #1968.
