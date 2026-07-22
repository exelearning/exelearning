---
id: ADR-0043
title: "Assets own attribution: iDevices drop per-media author/license fields in favor of a show-attribution toggle"
status: Proposed
date: 2026-07-22
deciders:
  - "@erseco"
reviewers: []
related:
  issues: []
  prs: [1868]
  sdds: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# ADR-0043: Assets own attribution: iDevices drop per-media author/license fields in favor of a show-attribution toggle

## Status

Proposed

## Context

PR #1868 centralizes asset attribution metadata (title, description, license,
author, author link, source URL) in the File Manager, stored on the asset in the
Yjs document. Two consumers already treat that store as the single source of
truth for `asset://` media:

- `exeimage` derives the figure caption from centralized metadata; the dialog
  keeps only per-instance presentation controls (heading, notes, hide-caption).
- `exemedia` adopted the same model (`90b1701b`), and export baking resolves
  captions for image and media figures at export time (`0db59493`).

Game iDevices (~24 editions with per-media "Authorship" inputs) and the image
gallery still store an editable author/license copy per media item. The current
batch only added an opt-in prefill (`0cf6c89c`, `deb96be7`): picking an asset
seeds the empty Authorship field from centralized metadata. Field removal was
explicitly deferred at the time and listed in the PR #1868 batch comment as a
"chosen default pending team confirmation".

## Problem

Should game iDevices and the image gallery keep editable per-media
author/license fields, or should attribution for `asset://` media be owned
exclusively by the asset, with iDevices storing only presentation flags?

## Decision drivers

- Single source of truth: editable copies drift — prefill only fills empty
  fields, so later File Manager edits never reach already-filled game fields.
- Consistency: exeimage/exemedia already removed per-instance attribution for
  `asset://` sources; keeping it in games is an inconsistency users notice.
- Edition UI noise: per-media author inputs multiply across game questions.
- External sources: media not managed by the File Manager (external URLs) has
  no asset record, so per-instance fields must remain available there.
- Legacy content: existing projects carry hand-written per-media attribution
  that must not be silently destroyed at import time.

## Options considered

### Option 1: Keep editable fields with prefill (status quo after PR #1868)

Pros: no data-format change; smallest diff. Cons: permanent dual source of
truth; drift by design; inconsistent with exeimage/exemedia; per-media UI noise.

### Option 2 (chosen): Remove fields for asset-backed media; resolve attribution at render/export; add a show-attribution toggle

Store only the asset reference plus presentation flags. Editions show no
author/license inputs for `asset://` media; a per-activity "Show attribution"
toggle controls whether the attribution line renders (precedent: the Resource
Report's `showAuthor`/`showLicense` config toggles). Export renderers resolve
author/license from centralized metadata at bake time, following the
`bakeFigureCaptions` pattern. External (non-`asset://`) sources keep
per-instance fields, shown only when the source is external (same branching as
exeimage/exemedia).

Pros: one source of truth; File Manager edits propagate everywhere; consistent
model across iDevices. Cons: touches stored formats and export renderers of the
whole game family; needs a legacy boundary.

### Option 3: Keep stored copies but overwrite them from asset metadata on every save

Pros: export renderers unchanged. Cons: still copies (stale in unedited
components); write amplification; the "editable-looking" fields would lie.

## Evidence

- Centralized metadata store and File Manager editing:
  `public/app/workarea/modals/modals/pages/modalFileManager.js` @ `2656d8b7`.
- exemedia centralization + export baking for media figures:
  `public/libs/tinymce_5/js/tinymce/plugins/exemedia/plugin.min.js` @
  `90b1701b`; `src/shared/export/figure-caption.ts` @ `0db59493`.
- Prefill stopgap and picker wiring: `public/app/common/common_edition.js`,
  `.../content/ideviceNode.js` @ `0cf6c89c`; 31 pickers across 24 games @
  `deb96be7`.
- Per-activity visibility toggles precedent:
  `public/files/perm/idevices/base/resource-report/export/resource-report.js`
  (`showAuthor` / `showLicense`).
- Deferral record: PR #1868 batch comment ("Chosen defaults pending team
  confirmation").

## Decision

For media referenced through the File Manager (`asset://`), attribution
(author, author link, license, title, source URL) is owned by the asset.
Game iDevices and the image gallery will:

1. Stop storing and editing per-media author/license for asset-backed media.
2. Gain a per-activity "Show attribution" toggle (default: preserve each
   iDevice's current visible behavior) that controls rendering of the
   attribution line derived from centralized metadata at render/export time.
3. Keep per-instance attribution fields only for external sources, shown only
   when the source is external.
4. Adopt centralized values on the next edition save of a legacy component
   (import never rewrites stored content) — the same save-triggered boundary
   exemedia applies to legacy figures.

## Consequences

### Positive

- File Manager metadata edits propagate to every game/gallery usage.
- Simpler game editions; one attribution model across all iDevices.

### Negative

- Reworks stored formats and export renderers across ~24 games — a large,
  mechanical but risky batch.
- Hand-written legacy attribution is replaced by centralized data when a legacy
  component is next saved; if the asset has no author, the line disappears
  unless the author is added in the File Manager first.

### Neutral

- The prefill added in PR #1868 remains useful during the transition and for
  the external-source fields that survive.

## Risks

- Silent attribution loss on legacy content saves (mitigate: release note +
  the toggle default keeping lines visible; consider a one-time hint in the
  edition UI when a legacy value is being replaced).
- Per-game export renderers diverge in how they print attribution; a shared
  attribution-line helper (sibling of `buildFigureCaption`) is needed to avoid
  24 hand-rolled variants.

## Validation

- E2E per migrated iDevice: File Manager author edit propagates to authoring
  view and exported package without re-editing the component.
- Existing game E2E suites stay green; static export suite included.

## Follow-up work

- **Open a dedicated implementation issue** (this ADR intentionally replaces
  opening it now, so the decision can be reviewed inside PR #1868 first).
- Write an SDD proposing two phases: image gallery as pilot (single iDevice,
  already has `seedAttributionFromAsset`), then the game family, both using a
  shared attribution-line builder.
- Implement in a follow-up branch — explicitly out of scope for PR #1868.

## References

- PR #1868 and its batch summary comment (chosen defaults section).
- Commits: `2656d8b7`, `90b1701b`, `0db59493`, `0cf6c89c`, `deb96be7`.
- `doc/architecture/adr/README.md` (ADR policy).
