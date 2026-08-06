---
id: ADR-1858-02
title: "Store attachments as stable asset:// references with render-at-view-time export rewrite"
status: Proposed
date: 2026-07-09
tracking_issue: 1858
legacy_id: ADR-0036
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnunezcedec"
related:
  prs: [2011]
  changes: ["1858-file-attachment-restoration"]
  adrs: [ADR-1858-01, ADR-1858-03, ADR-1858-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1858-02: Store attachments as stable asset:// references with render-at-view-time export rewrite

## Context

The restored `file-attachment` iDevice (ADR-1858-01) is a JSON iDevice: its state
lives in `jsonProperties` inside the Y.Doc, and its downloadable files are binary
assets that must survive editing, preview, real-time collaboration, ELPX
round-trips, and export to HTML5/SCORM/EPUB. eXeLearning already has one canonical
way to name a binary asset independently of where it currently lives: the
`asset://<uuid>.<ext>` reference minted by the `AssetManager`. The same reference
is resolved to a live `blob:` URL in the editor/preview and rewritten to a
packaged `content/resources/...` path on export — this is exactly how images and
other media are handled today.

An attachment therefore needs a *stable identifier* that does not break when the
file is renamed, when the document is reloaded from IndexedDB, when a second
collaborator loads the project, or when the package is exported. A resolved
`blob:` URL is none of those things (it is per-session and per-tab). A packaged
`content/resources/...` path only exists after export. A base64 blob inline in the
Y.Doc would bloat every snapshot. This ADR fixes the model the iDevice uses to
reference its files.

## Problem

What value should the `file-attachment` iDevice persist per attachment so the file
resolves correctly in the editor, in preview, in collaboration, and in every
export target — and how is that value turned into a working download link at each
of those stages?

## Decision drivers

- **Stability across reload, rename and collaboration**: the reference must not
  depend on session-local state.
- **Consistency with the existing asset pipeline**: reuse `asset://` resolution
  and export rewrite that images already rely on (single source of truth).
- **Small document state**: keep binaries out of the Y.Doc.
- **Offline/resilient rendering**: attachments should still show a filename and
  size even if the live asset cannot be resolved (see ADR-1858-04).
- **Export correctness**: the download link must point at a packaged file in the
  exported HTML5/SCORM/EPUB output.

## Options considered

### Option 1: Persist a stable `asset://<uuid>.<ext>` reference plus a metadata snapshot (chosen)

Each attachment stores `{ url: "asset://<uuid>.<ext>", filename, mimeType, size,
title, description }`. `url` is the stable reference; `filename`/`mimeType`/`size`
are a metadata snapshot used for display and as a fallback when the live asset is
unavailable. Resolution happens per stage:

- **Editor / preview**: `renderBehaviour` resolves `asset://` links to `blob:`
  URLs via `AssetManager.resolveAssetURLSync` / `resolveAssetURL`.
- **Export**: the export renderer rewrites `asset://<uuid>.<ext>` to
  `content/resources/<exportPath>` using the asset export-path map.
- **Legacy import**: `resources/<filename>` paths are rewritten to `asset://` once
  the binary is registered.

- Pros: one identifier valid everywhere; reuses proven image-asset plumbing;
  document state stays tiny; metadata snapshot enables offline/missing-asset
  rendering.
- Cons: the on-disk/in-doc `url` is not directly clickable — it must be resolved
  or rewritten before it works, so any renderer that forgets this shows a dead
  `asset://` link.

### Option 2: Persist the resolved `blob:` URL

Store whatever the AssetManager currently resolves to.

- Pros: immediately clickable in the current tab.
- Cons: `blob:` URLs are session- and tab-scoped; they break on reload, for other
  collaborators, and in export. Non-starter.

### Option 3: Persist the packaged `content/resources/...` path

Store the export path directly.

- Pros: correct in the final export.
- Cons: that path does not exist during authoring/preview; the editor could not
  resolve or display the file, and collaboration/round-trip would carry a path to
  nowhere.

### Option 4: Inline base64 bytes in `jsonProperties`

Embed the file in the component state.

- Pros: fully self-contained.
- Cons: bloats the Y.Doc and every snapshot, breaks asset de-duplication, and
  contradicts the "binaries live in the Media Library" architecture. Rejected in
  ADR-1858-01 as well.

## Evidence

All paths verified on the PR #2011 branch.

- Persisted shape: `public/files/perm/idevices/base/file-attachment/edition/file-attachment.js`
  — `collectAttachments()` and `save()` emit
  `{ url, filename, mimeType, size, title, description }`; `addAttachmentFromAsset()`
  reads `result.assetUrl` and the `asset` metadata; `uploadFile()` stores
  `assetManager.insertImage(file)`'s returned `asset://` URL plus
  `getAssetMetadata()` fields.
- Documented JSON shape: `doc/elpx-format/idevices/snippets.md` — the
  `## file-attachment` example shows attachments with
  `"url":"asset://<uuid>.<ext>"` and the metadata snapshot, and states the `url`
  values are rewritten to packaged `content/resources/...` on export.
- Editor/preview resolution: `public/files/perm/idevices/base/file-attachment/export/file-attachment.js`
  — `renderBehaviour()` selects `a.fileAttachment-link[href^="asset://"]` and
  `resolveAssetHref()` calls `assetManager.resolveAssetURLSync(assetUrl)` then
  `assetManager.resolveAssetURL(assetUrl)`.
- Export rewrite: `src/shared/export/renderers/IdeviceRenderer.ts` — the
  `asset:\/\/([^"']+)` replacement matches the new `uuid.ext` format and rewrites
  it to `${basePath}content/resources/${exportPath}` via `assetExportPathMap`
  (also handles the legacy `uuid/path` form and bare `resources/...` paths).
  Contract described in `src/shared/export/interfaces.ts` ("Preview mode:
  asset:// → blob:// URLs; Export mode: asset:// → relative paths
  content/resources/...").
- Import rewrite: `src/shared/import/ElpxImporter.ts` —
  `convertAssetPathsInObject()` rewrites `resources/<filename>` strings to
  `asset://` via `findAssetUrlForPath()` (which builds `asset://<uuid>.<ext>`).
  The browser twin is `public/app/yjs/ComponentImporter.js`
  (`convertAssetPathsInObject`).
- Round-trip test: `test/integration/legacy-file-attachment.spec.ts` — asserts
  every imported attachment `url` starts with `asset://` and no longer starts with
  `resources/`.
- Export/preview coverage:
  `public/files/perm/idevices/base/file-attachment/export/file-attachment.test.js`
  ("resolves asset:// download links to blob URLs via the live AssetManager") and
  the Playwright spec, which asserts the stored `data-url` matches `^asset://` and
  the rendered link carries a `download` attribute.

## Decision

We will persist each attachment as `{ url: "asset://<uuid>.<ext>", filename,
mimeType, size, title, description }`, where `url` is the stable Media Library
reference and the filename/mimeType/size form a display + fallback snapshot. The
`asset://` reference is resolved to `blob:` in the editor/preview by
`renderBehaviour`, rewritten to `content/resources/<exportPath>` by the export
renderer, and produced from legacy `resources/<filename>` paths on import. The
binary asset in the Media Library remains the single source of truth; the iDevice
never stores file bytes.

## Consequences

### Positive

- One stable identifier is valid across editor, preview, collaboration, ELPX
  round-trip, and every export target.
- Reuses the existing image-asset resolution/rewrite paths — no new export logic
  specific to attachments beyond emitting `asset://` links.
- Document state stays small; assets de-duplicate via the Media Library.
- The metadata snapshot lets the iDevice render a filename and size even when the
  live asset cannot be resolved (basis for ADR-1858-04).

### Negative

- The persisted `url` is not directly usable; a renderer that fails to
  resolve/rewrite it will show a dead `asset://` link. This spreads the same
  "resolve before use" obligation the image pipeline already carries.
- The metadata snapshot can drift from the live asset (e.g. after a rename by
  another collaborator); the edition code reconciles it against the live asset map
  (ADR-1858-04), but a stale snapshot may persist until reconciliation runs.

### Neutral

- The `size`/`mimeType` snapshot may be `0`/empty when the source (Media Library
  selection or legacy import) does not provide it; rendering degrades gracefully
  (size hidden, generic icon).

## Risks

- **Missing export-path mapping** (low likelihood, medium severity): if
  `assetExportPathMap` lacks the UUID, the rewrite leaves the original `asset://`
  link, producing a non-working download in the export. Mitigation: the same map
  drives image export and is populated for all packaged assets; missing assets
  additionally fall back to the placeholder rendering in ADR-1858-04.
- **Snapshot/asset divergence** (medium likelihood, low severity): filename/size
  shown may lag the live asset. Mitigation: `refreshRowFromAsset()` reconciliation
  (ADR-1858-04).

## Validation

- `test/integration/legacy-file-attachment.spec.ts` asserts `asset://` rewriting
  end-to-end through the real `ElpxImporter`.
- The export Vitest spec asserts blob resolution and correct `href`/`download`
  markup; the Playwright spec asserts a resolvable download link in view and
  preview.
- Manual check: export an ELPX/HTML5 package and confirm the attachment link
  resolves to `content/resources/<file>` and downloads the original bytes.

## Follow-up work

- Document the `asset://` resolution/rewrite contract centrally so future
  iDevices reuse it consistently (currently spread across `IdeviceRenderer.ts`,
  `ElpxImporter.ts`, and per-iDevice export JS).

## References

- Issue #1858, PR #2011, the #1858 change design.
- ADR-1858-01 (iDevice restoration), ADR-1858-03 (legacy remap), ADR-1858-04 (resilience).
- `src/shared/export/renderers/IdeviceRenderer.ts`,
  `src/shared/export/interfaces.ts`.
- `src/shared/import/ElpxImporter.ts`, `public/app/yjs/ComponentImporter.js`.
- `doc/elpx-format/idevices/snippets.md` (JSON shape),
  `doc/architecture.md` §7.1/§7.3 (client-is-source-of-truth, asset storage).
