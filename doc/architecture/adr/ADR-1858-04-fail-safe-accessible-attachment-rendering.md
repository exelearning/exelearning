---
id: ADR-1858-04
title: "Missing-asset resilience and accessibility strategy for attachments"
status: Proposed
date: 2026-07-09
tracking_issue: 1858
legacy_id: ADR-0038
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnunezcedec"
related:
  prs: [2011]
  changes: ["1858-file-attachment-restoration"]
  adrs: [ADR-1858-01, ADR-1858-02, ADR-1858-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1858-04: Missing-asset resilience and accessibility strategy for attachments

## Context

Because attachments are stored as `asset://` references (ADR-1858-02) rather than
embedded bytes, the referenced binary can legitimately be *absent* at several
points: an author (or a collaborator) deletes or renames the file in the Media
Library while the iDevice is open; a legacy `.elp` is imported whose `resources/`
binary is missing from the ZIP; or an export is produced for a component whose
asset was never registered. The iDevice must not present broken links or stale
filenames, and — as a learner-facing content element rendered into HTML5/SCORM/
EPUB — it must be keyboard- and screen-reader-accessible. The attachment title,
description and filename are author- (and legacy-file-) controlled strings, so the
rendered output must be safe against HTML/script injection.

## Problem

How should the `file-attachment` iDevice behave when a referenced asset is
renamed or missing, and what accessibility and output-safety guarantees must its
authoring and export rendering provide?

## Decision drivers

- **Fail safe, not broken**: a missing asset should degrade to an informative
  placeholder, never a dead link or a crash.
- **Stay in sync**: rename/delete in the Media Library should reflect in the open
  editor without a manual refresh.
- **Accessibility (WCAG)**: keyboard operable controls, screen-reader labels,
  meaningful link text, non-decorative-icon handling, visible focus.
- **No unrequested change of context**: a download link must not move the learner
  to a new tab/window (WCAG 2.2 SC 3.2.5 *Change on Request*, technique G200; a
  new-tab link would additionally require an announced "(opens in a new tab)"
  indicator per technique G201).
- **Honest controls**: every attachment link carries the `download` attribute, and
  per the HTML spec a downloading hyperlink never consults `target` — so a per-file
  "open in a new tab" option cannot actually deliver a new tab for the same-origin
  files this iDevice serves. The UI must not offer behavior the browser will not
  perform.
- **Constrained runtimes**: in sandboxed iframes (hardened preview/embedding),
  `target="_blank"` fails silently without `allow-popups`; in the Electron app it
  requests a new chromeless `BrowserWindow`. Plain downloads work in both.
- **Runtime-safe strings**: the export code runs in the generated site, where the
  editor-only `c_()` / `_()` helpers do not exist — only the pre-resolved
  `$exe_i18n` bundle shipped as `libs/common_i18n.js`.
- **Output safety**: escape all author/legacy-controlled attachment fields in the
  rendered HTML.
- **No new dependencies**: use inline SVG icons (no icon font) so rendering works
  in every export target.

## Options considered

### Option 1: Reconcile against the live asset map + safe placeholder + escaped, accessible markup (chosen)

- **Edition resilience**: observe the shared Yjs assets map (there is no dedicated
  asset-change event), and on any change reconcile each row: update
  filename/icon/size on rename, or flag the row `--missing` with a warning on
  delete. The observer self-detaches once the iDevice DOM is torn down.
- **Export resilience**: when an attachment has no resolvable `url`, render a
  non-clickable placeholder (`fileAttachment-link--missing`) with a "File
  unavailable" label instead of an `<a>` with a dead `href`.
- **Import resilience**: preserve filename/title even when the binary is missing;
  never crash.
- **Accessibility**: visually hidden "Download" prefix (`exe-sr-only`) so link
  text reads "Download <label>"; `aria-label` on reorder/delete buttons;
  `aria-hidden` on decorative icons; `aria-expanded` on the collapsible
  title/description panel; `download` attribute on links; `:focus`/`:focus-visible`
  styles in CSS.
- **Link target**: attachments are always plain download links — the renderer
  never emits `target`/`rel`, and a stored `openInNewWindow` flag (written by
  earlier revisions of this branch) is ignored. A per-file "Open in a new tab or
  window" checkbox existed briefly during review but was removed: the always-on
  `download` attribute makes `target` inert for same-origin files, so the option
  promised behavior browsers do not deliver, while still costing the G201
  indicator, sandbox `allow-popups` and Electron window-policy work. Authors who
  want an in-browser viewing link can create a regular link in a Text iDevice.
- **Export-runtime strings**: export rendering resolves its labels through a local
  `translate(key, englishFallback)` helper that reads the `$exe_i18n` bundle, never
  through `c_()`/`_()`. The English literal is used when the bundle or key is
  absent, so a missing string can never abort the render.
- **Output safety**: `escapeHtml`/`escapeAttr` applied to filename, title,
  description, and the icon label in both edition and export renderers.

- Pros: no broken links; live sync; accessible and injection-safe; no icon-font
  dependency.
- Cons: observing the raw Yjs map is a workaround for a missing event API and adds
  observer-lifecycle code; reconciliation is best-effort (runs when the map
  changes, not on a formal signal).

### Option 2: Broken link / do nothing on missing asset

Render the `asset://` (or empty) `href` as-is.

- Pros: least code.
- Cons: learners get 404s / dead links; authors get no signal that a file went
  missing. Rejected.

### Option 3: Silently drop missing attachments

Remove attachments whose asset is gone.

- Pros: no broken UI.
- Cons: silent data loss — the author loses the title/description they wrote and
  any record that a file was expected. Rejected in favour of a visible, editable
  placeholder.

## Evidence

All paths verified on the PR #2011 branch.

- Edition sync: `public/files/perm/idevices/base/file-attachment/edition/file-attachment.js`
  — `observeAssetChanges()` observes `assetManager.getAssetsYMap()` (comment notes
  "There is no dedicated asset-change event"); the handler self-cleans via
  `assetsMap.unobserve(handler)` when `document.contains(body)` is false;
  `refreshRowFromAsset()` updates filename/icon or calls `setRowMissing(row, true)`
  when `getAssetMetadata` returns nothing; `setRowMissing()` toggles
  `fileAttachment-edit-item--missing` and inserts/removes a warning
  ("The attached file is missing. Re-add it from the Media Library.").
- Export placeholder: `public/files/perm/idevices/base/file-attachment/export/file-attachment.js`
  — `renderItem()` emits an `<a class="fileAttachment-link" download=...>` when a
  `url` exists, and otherwise a non-clickable
  `<span class="fileAttachment-link fileAttachment-link--missing">` with
  `translate('fileUnavailable', 'File unavailable')`.
- Link target (export): `renderItem()` never emits `target`/`rel` — links carry
  only `href` and `download`; the edition UI has no per-file target control and
  `collectAttachments()` does not persist `openInNewWindow`, so the flag is
  dropped from documents that stored it.
- Export-runtime strings: `translate(key, fallback)` reads `window.$exe_i18n`
  (shipped as `libs/common_i18n.js`, generated from
  `public/app/common/common_i18n.js` by `scripts/build-i18n-bundles.js`) and falls
  back to the English literal. Keys `attachment`, `noFilesAttached` and
  `fileUnavailable` were added to that template; `download` already existed.
- Accessibility markup (export): `renderItem()` wraps link text with
  `<span class="exe-sr-only">${translate('download', 'Download')} </span>`; icons carry
  `aria-hidden="true"`; the CSS defines `.fileAttachment-IDevice .exe-sr-only`,
  `.fileAttachment-link:focus` and `:focus-visible`
  (`public/files/perm/idevices/base/file-attachment/export/file-attachment.css`).
- Accessibility markup (edition): reorder/delete buttons carry `aria-label`
  (`Move up`/`Move down`/`Delete`); the details toggle uses `aria-expanded`;
  decorative icons use `aria-hidden`.
- Self-contained icons: `getFileIconSvg()` (both edition and export) builds an
  inline SVG labelled with the file extension — no icon-font dependency.
- Output escaping: `escapeHtml`/`escapeAttr` in both
  edition/file-attachment.js and export/file-attachment.js are applied to
  filename, title, description and icon label.
- Tests:
  - Edition Vitest (`.../edition/file-attachment.test.js`): "flags a row whose
    asset reference is missing and preserves the empty url on save"; "escapes a
    malicious filename in the rendered row markup"; "round-trips a title
    containing HTML/quotes without breaking the row".
  - Export Vitest (`.../export/file-attachment.test.js`): "renders a safe
    placeholder for a missing asset instead of a broken link"; "escapes
    user-controlled title, description and filename"; "includes an accessible
    'Download' prefix"; "does not emit id attributes inside list items (no
    duplicate IDs across instances)".
  - Export Vitest (`.../export/file-attachment-i18n.test.js`): renders every label
    with `c_`/`_` deleted from the global scope (the exported-site environment),
    asserting no `ReferenceError`, `$exe_i18n` use when present, and the English
    fallback when a key is missing or blank.
  - Target Vitest (`.../export/file-attachment-target.test.js`,
    `.../edition/file-attachment-target.test.js`): links never carry `target`/`rel`
    (even when older data stores `openInNewWindow: true`), the edition renders no
    per-file target checkbox, and a stored flag is dropped on save.
  - Playwright (`test/e2e/playwright/specs/idevices/file-attachment.spec.ts`):
    "reflects renaming and deleting a referenced asset in the Media Library"
    asserts the row updates on rename and gains
    `fileAttachment-edit-item--missing` + a visible warning on delete; "shows the
    download link in the preview panel" additionally fails on any
    `is not defined` / `Could not load template` console output and asserts the
    preview link carries no `target="_blank"`.
  - Integration (`test/integration/legacy-file-attachment.spec.ts`): "does not
    crash when the attached binary files are missing from the package".

## Decision

We will make the `file-attachment` iDevice fail safe and accessible: the editor
observes the live Media Library asset map and reconciles each attachment row
(updating on rename, flagging `--missing` with a warning on delete, self-detaching
the observer on teardown); the export renders a non-clickable "File unavailable"
placeholder instead of a broken link when an asset cannot be resolved; import
preserves attachment metadata without crashing when binaries are absent; and all
rendered markup uses `exe-sr-only` link prefixes, `aria-*` labels, `download`
attributes, visible focus styles, dependency-free inline SVG icons, and
`escapeHtml`/`escapeAttr` on every author/legacy-controlled field.

Download links **always** stay in the current browsing context: the renderer emits
`href` + `download` and never `target`/`rel` (WCAG 2.2 SC 3.2.5 *Change on
Request* / technique G200), and a stored `openInNewWindow` flag is ignored and
dropped on save. Since the `download` attribute makes `target` inert for the
same-origin files this iDevice serves, a target option could not work as labelled;
in-browser viewing links belong in a Text iDevice instead. Export-side strings are
resolved from the `$exe_i18n` bundle with
an English fallback — the editor-only `c_()`/`_()` helpers must never be called
from export code.

## Consequences

### Positive

- No broken download links or 404s for learners; authors get a clear, editable
  "missing file" signal.
- The open editor stays in sync with Media Library renames/deletes without a
  manual reload.
- Accessible link text, controls, focus and icons; renders without an icon font in
  all export targets.
- Attachment titles/filenames/descriptions are escaped, closing the obvious
  injection vector on those fields.
- No unrequested change of context, ever: learners keep their place and the Back
  button keeps working; there is no per-file state to maintain, announce (G201)
  or test across web, preview, desktop and sandboxed-embed runtimes.
- Export rendering no longer depends on an editor-only global, so a missing
  translation helper can never abort the iDevice render in a generated site.

### Negative

- Observing the raw Yjs assets map is a workaround for the absence of a formal
  asset-change API and adds observer-lifecycle bookkeeping.
- Reconciliation is best-effort: it fires on asset-map changes, so a rename that
  arrives through an unusual path (or before the observer attaches) may show stale
  data until the next change.

### Neutral

- The `intro` (instructions) field is authored via TinyMCE and rendered as raw
  HTML in the export (like other rich-text iDevice fields); it is intentionally
  *not* escaped here and relies on the shared HTML sanitization layer applied to
  rich-text content elsewhere in the pipeline, not on this iDevice.

## Risks

- **Threat model / residual XSS surface**: attachment `title`, `description`,
  `filename` and the icon label are escaped in both renderers, so those fields are
  not an injection vector. The `intro` field carries author-authored rich HTML and
  is emitted verbatim; its safety depends on the project's shared sanitizer, not on
  this iDevice — a gap in that sanitizer would surface here as it does in other
  rich-text iDevices. The persisted `url` is expected to be an `asset://`
  reference; the export rewrite only transforms `asset://`/`resources` forms, and
  a non-asset `url` would render as an `href` — in the normal Media Library flow
  the value is always AssetManager-minted, but a hand-edited/hostile ELPX could in
  principle carry another scheme. Residual risk: `href`/`intro` sanitization is
  delegated to shared layers and not re-asserted by this iDevice.
- **Observer leak** (low likelihood, low severity): if teardown detection fails
  the observer could linger. Mitigation: the `document.contains(body)` self-clean
  in `observeAssetChanges()`.

## Validation

- Edition/export Vitest specs cover missing-asset placeholder, escaping and the
  accessible download prefix (see Evidence).
- The Playwright rename/delete spec validates live sync and the missing-state UI.
- The integration test validates crash-free import with missing binaries.
- Recommended follow-up: an automated accessibility assertion (e.g. axe) over the
  rendered attachment list in E2E.

## Follow-up work

- Propose a first-class AssetManager change-event API so iDevices stop observing
  the raw Yjs map.
- Add an explicit accessibility check to the Playwright spec.
- Confirm the `intro` rich-text field is covered by the shared sanitizer on the
  export path and document that dependency.

## References

- Issue #1858, PR #2011, the #1858 change design.
- WCAG 2.2 SC 3.2.5 *Change on Request*
  (<https://www.w3.org/WAI/WCAG22/Understanding/change-on-request.html>),
  technique G200 *Opening new windows and tabs from a link only when necessary*
  (<https://www.w3.org/WAI/WCAG22/Techniques/general/G200>) and technique G201
  *Giving users advanced warning when opening a new window*
  (<https://www.w3.org/WAI/WCAG22/Techniques/general/G201>).
- HTML Standard, *downloading resources* — following a hyperlink with a
  `download` attribute downloads instead of navigating; `target` is not consulted
  (<https://html.spec.whatwg.org/multipage/links.html#downloading-resources>).
- MDN `<iframe>` `sandbox` — without `allow-popups`, `target="_blank"` fails
  silently
  (<https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox>).
- Electron `window.open` — `target="_blank"` creates a new `BrowserWindow` subject
  to `setWindowOpenHandler` (<https://www.electronjs.org/docs/latest/api/window-open>).
- ADR-1858-01 (iDevice restoration), ADR-1858-02 (reference model), ADR-1858-03 (legacy
  remap).
- `public/files/perm/idevices/base/file-attachment/edition/file-attachment.js`,
  `.../export/file-attachment.js`, `.../export/file-attachment.css`.
- `AGENTS.md` §7.4 (accessibility/i18n patterns), `doc/development/styles.md`.
