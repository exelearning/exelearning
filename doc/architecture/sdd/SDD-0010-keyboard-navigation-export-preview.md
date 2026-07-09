---
id: SDD-0010
title: "Keyboard navigation for exported and previewed content"
status: Implemented
date: 2026-07-09
authors:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
related:
  issues: [2019]
  prs: [2020, 2149]
  adrs: [ADR-0039, ADR-0040, ADR-0041]
  sdds: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# SDD-0010: Keyboard navigation for exported and previewed content

## Status

Implemented

## Summary

Exported and previewed eXeLearning content can now be navigated from the
keyboard, restoring a capability from the legacy eXeLearning 2.9 "Presentation"
style (issue #2019). When an author enables the new **Keyboard navigation**
export option, readers can move between pages with the arrow keys and toggle the
navigation menu, search box and Teacher Mode from the keyboard. The behavior
lives in the shared export/preview runtime, is off by default, and defers to any
open overlay widget (lightbox galleries, full-screen media) so it never fights
content that is already keyboard-driven.

## Problem statement

Readers of exported packages had no keyboard affordance for the most common
navigation actions; everything required a pointer. Educators migrating from
eXeLearning 2.9 expected the old "Presentation"-style arrow-key navigation.
Naively adding global key handling risks two regressions: silently changing
navigation for existing content, and colliding with widgets (image galleries,
full-screen video) that own the keyboard while open.

## Goals

- Arrow keys navigate between pages in exported and previewed content.
- Keyboard toggles for the nav menu, the search box, and Teacher Mode.
- Off by default; enabled per project via an export option.
- Never hijack keys while the reader is typing in a field.
- Fully yield to open overlays/lightboxes/full-screen media.
- One implementation shared by every export format and the in-app preview.

## Non-goals

- No new per-theme JavaScript and no new standalone export library (see
  ADR-0039).
- No focus-management/tab-order overhaul of exported pages; this design adds
  navigation shortcuts, not a full focus framework.
- No changes to the authoring workarea's own keyboard shortcuts
  (`public/app/common/shortcuts.js`); this is reader-facing only.
- No new user-facing shortcut for arbitrary modifier combinations reserved by
  the browser (Ctrl/Cmd/Alt combinations are deliberately avoided).

## Current state

- Exported and previewed pages already load a single shared client runtime,
  `public/app/common/exe_export.js` (`window.$exeExport`), via
  `libs/exe_export.js`. Preview reuses the export path:
  `Html5Exporter.generateForPreview()`
  (`src/shared/export/exporters/Html5Exporter.ts` line 560) renders pages through
  `PageRenderer`, the same component a real export uses
  (`src/shared/export/renderers/PageRenderer.ts` lines 315, 1338).
- Themes emit stable navigation elements — `#siteNav`, `.nav-button-left` /
  `.nav-button-right`, `#siteNavToggler`, `#searchBarTogger` /
  `#exe-client-search-text`, `#teacher-mode-toggler` — that respond to clicks.
- The export pipeline has an established pattern for boolean export options
  (`addSearchBox`, `addMathJax`, `addAccessibilityToolbar`) threaded from
  `src/shared/export/metadata-properties.ts` through the properties UI, Yjs
  metadata, `YjsDocumentAdapter`, and the exporters. The operational reference
  for this pipeline and for project metadata is in
  [doc/elpx-format/export-pipeline.md](../../elpx-format/export-pipeline.md) and
  [doc/elpx-format/metadata.md](../../elpx-format/metadata.md); the overall
  client-is-source-of-truth architecture is in
  [doc/architecture.md](../../architecture.md).

## Proposed design

Add a `keyboardNav` module to `window.$exeExport` in the shared runtime and a
new `addKeyboardNavigation` export option that gates it. The module attaches a
single document-level `keydown` listener only when the author opted in and the
reader has not opted out. It maps keys to actions by locating and clicking the
theme's existing navigation elements, so the theme's own handlers remain the
single source of truth for what each action does.

```
Author toggles "Keyboard navigation" (properties UI)
  → pp_addKeyboardNavigation stored in Yjs metadata
    → YjsDocumentAdapter.parseBoolean(..., false)  → meta.addKeyboardNavigation
      → Html5Exporter passes addKeyboardNavigation to PageRenderer
        → PageRenderer emits <script>window.exeKeyboardNavEnabled=true;</script>
          BEFORE libs/exe_export.js  (export OR preview)
            → keyboardNav.init() reads the flag and attaches keydown
              → handleKeydown: overlay gate → typing gate → shortcut dispatch
                → clicks existing theme elements (nav links, togglers)
```

Design rationale is captured in three ADRs: where the runtime lives (ADR-0039),
opt-in/off-by-default plumbing (ADR-0040), and overlay-aware suppression
(ADR-0041).

## User experience

When the option is enabled, a reader of the exported/previewed content can use:

- **ArrowLeft / ArrowRight** — previous / next page (`a.nav-button-left` /
  `a.nav-button-right`).
- **ArrowUp / ArrowDown** — first / last page in the site nav
  (`#siteNav a[href]`).
- **`m` or `Alt+M`** — toggle the navigation menu (`#siteNavToggler`).
- **`Alt+/`** — reveal and focus the search box (never shadows Ctrl/Cmd+F).
- **`t`** — toggle the Teacher Mode content layer, but only where Teacher Mode is
  active on the page (i.e. `#teacher-mode-toggler` exists); it never shadows
  Ctrl/Cmd+T.

Edge cases handled: shortcuts do nothing while the reader is typing in a field
or composing text; plain arrow keys are ignored when any modifier is held (so
Alt+Left/Right browser history still works); and shortcuts are suppressed while
an overlay is open. A reader can disable the feature per session with
`?keyboard-navigation=false` or a `exeKeyboardNavigationDisabled` localStorage
value.

## Technical design

**Runtime module** — `public/app/common/exe_export.js`, `keyboardNav` (lines
558-800), initialized from `$exeExport.init()` (line 45, try/catch wrapped):

- `init()` / `destroy()` — attach/detach the single `keydown` listener; guarded
  by `_initialized`, `isEnabled()`, and `isShortcutDisabled()` (lines 562-575).
- `isEnabled()` — `window.exeKeyboardNavEnabled === true` (lines 578-580).
- `isShortcutDisabled()` — reads `?keyboard-navigation=false` and localStorage,
  each in its own try/catch (lines 582-597).
- `isTypingTarget(target)` — `closest('input, textarea, select,
  [contenteditable]:not([contenteditable="false"]), [role="textbox"]')`
  (lines 600-605).
- Link lookups: `getPreviousLink`/`getNextLink`/`getFirstNavLink`/`getLastNavLink`
  (lines 607-622); `toggleMenu` (lines 624-629); `focusSearch` (lines 700-712);
  `toggleTeacherMode` (lines 738-743) — all operate on existing theme elements.
- Shortcut matchers use `KeyboardEvent.code` (physical key) with a `.key`
  fallback so they are layout-independent and do not misfire when Alt changes
  `.key` (e.g. Option+M → "µ" on macOS): `isMenuToggleShortcut` (lines 717-721),
  `isSearchShortcut` (lines 724-728), `isTeacherModeShortcut` (lines 746-750).
- `handleKeydown` (lines 758-799) gates in order: `defaultPrevented`/`isComposing`
  → `isOverlayActive()` → `isTypingTarget()` → menu/search/teacher matchers →
  plain arrow keys (bail if any modifier held). `activateLink` clicks the target
  and calls `preventDefault()` only when the event is cancelable.

**Overlay-signal registry** — `overlaySignals` (lines 643-686) with four probes
(exe_lightbox `.pp_pic_holder`+visibility, SimpleLightbox `.sl-wrapper`,
`.Games-OverlayImage`, `.mejs-container-fullscreen`); `isOverlayActive()`
aggregates them with per-probe try/catch (lines 688-698). See ADR-0041.

**Server/shared rendering** — `src/shared/export/renderers/PageRenderer.ts`
emits `<script>window.exeKeyboardNavEnabled=true;</script>` before
`libs/exe_export.js` when `addKeyboardNavigation` is set, in both `renderHead()`
(lines 308-315) and `renderSinglePage()` (line 1338); default is `false`
(lines 122, 269, 1271).

**Option plumbing** — declared in
`src/shared/export/metadata-properties.ts` (lines 175-181); properties-UI
checkbox in `src/routes/config-params.ts` (lines 358-365); typed in
`src/shared/export/interfaces.ts` (lines 69, 677); read from Yjs in
`src/shared/export/adapters/YjsDocumentAdapter.ts` (line 110); consumed in
`src/shared/export/exporters/Html5Exporter.ts` (line 455); XML↔Yjs key mapping
in `public/app/yjs/YjsPropertiesBinding.js` (line 66) and
`public/app/yjs/YjsProjectBridge.js` (line 1880).

## Data model

One new project-metadata property:

| Yjs key | XML key | Type | Default |
|---|---|---|---|
| `addKeyboardNavigation` | `pp_addKeyboardNavigation` | boolean | `false` |

Stored in Yjs metadata (as `true`/`false`, tolerant of stringified booleans on
read) and serialized to the ELPX `content.xml` project properties like the other
`pp_*` export options. No database schema change; no new Yjs structure — it is a
single scalar in the existing metadata map. The runtime carries the setting to
the page only as the inline literal `window.exeKeyboardNavEnabled=true`; the
`?keyboard-navigation` query parameter and `exeKeyboardNavigationDisabled`
localStorage key are read-only opt-outs and are not persisted to the document.

## Migration and compatibility

- Backward compatible: the property defaults to `false`, so existing projects
  export exactly as before until an author enables it.
- Older packages without the flag simply never set `window.exeKeyboardNavEnabled`,
  so `keyboardNav.init()` is a no-op — the runtime is safe to ship in
  `exe_export.js` unconditionally.
- Themes lacking the standard nav elements degrade gracefully: the lookups
  return null and nothing happens.
- No rollback migration is needed; disabling the option (or removing it) reverts
  behavior.

## Security and privacy

- **Threat model**: the runtime executes in exported/previewed content and only
  (a) reads a boolean flag, a URL query parameter and a localStorage value, and
  (b) clicks elements already present in the page's DOM. It injects no HTML and
  introduces no new network calls.
- The `window.exeKeyboardNavEnabled=true` script is a hardcoded literal, not
  interpolated user content, so it adds no injection/escaping surface to the page
  head (contrast the xAPI config script, which serializes data and is XSS-hardened
  in `PageRenderer`).
- URL and localStorage reads are wrapped in try/catch so a malformed URL or a
  sandboxed/private-mode context cannot break page init
  (`public/app/common/exe_export.js` lines 582-597).
- **Residual risks**: the module depends on well-known selectors/marker classes;
  a theme or widget that renames them loses the shortcuts or (for overlay probes)
  could allow navigation during that overlay until its probe is updated. These
  are functional, not security, risks and are covered by tests. No PII, secrets,
  or authentication surface is involved.

## Accessibility

- Keyboard navigation is itself an accessibility affordance, but it is off by
  default because it changes standard page navigation and can conflict with other
  keyboard-driven content; authors opt in deliberately (ADR-0040).
- Typing targets are never hijacked (`isTypingTarget` covers inputs, textareas,
  selects, `contenteditable`, and `role="textbox"`).
- Reserved browser combinations are preserved: plain arrows only (no modifier),
  `Alt+/` never shadows Ctrl/Cmd+F, `t` never shadows Ctrl/Cmd+T.
- A per-visitor opt-out (`?keyboard-navigation=false` / localStorage) lets users
  who rely on other keyboard behavior disable it.

## Internationalization

- The only new user-facing strings are the properties-UI title
  ("Keyboard navigation") and help text in `src/routes/config-params.ts`
  (lines 358-365), authored with the existing `TRANS_PREFIX` translation
  mechanism used by the other properties. No hardcoded reader-facing strings are
  added by the runtime. No changes to `translations/**` are part of this design.

## Performance

- One document-level `keydown` listener, attached only when the feature is
  enabled. Per keystroke it runs a short sequence of `document.querySelector`
  checks (overlay probes, typing target, link lookups) — negligible cost and
  bounded by the number of overlay signals (currently four).
- No additional bytes are shipped when the feature is off beyond the small
  `keyboardNav` object already inside `exe_export.js`; no extra network requests.

## Testing strategy

- **Backend/shared unit** (`bun test`):
  `src/shared/export/renderers/PageRenderer.spec.ts` lines 2048-2096 (flag absent
  by default; present before `exe_export.js` when enabled across
  render/renderHead/renderSinglePage);
  `src/shared/export/adapters/YjsDocumentAdapter.spec.ts` lines 302-326 (default
  false; parses boolean and stringified `"true"`).
- **Frontend unit** (`vitest`): `public/app/common/exe_export.test.js` —
  `describe('keyboardNav')` (line 2387) covering enable/disable, typing target,
  link lookups, shortcut matchers, and activation; `describe('overlaySignals /
  isOverlayActive')` (line 2565) including throwing-probe isolation; overlay
  suppression (line 3127).
- **E2E** (`playwright`):
  `test/e2e/playwright/specs/preview-keyboard-navigation.spec.ts` — arrow
  navigation, `m`/`Alt+M` menu, `Alt+/` search, typing suppression, Teacher Mode
  toggle and no-op, default-off, and synthetic-overlay suppression;
  `test/e2e/playwright/specs/idevices/image-gallery.spec.ts` line 517 — real
  SimpleLightbox suppression and restoration. Helper
  `enableKeyboardNavigationOption()` in
  `test/e2e/playwright/helpers/workarea-helpers.ts` (line 1327).

## Rollout plan

Single feature landing in PR #2020, off by default, so no staged flag is
required. Follow-up refinements track under PR #2149. Because the option defaults
to `false`, the runtime can ship to all users immediately with no behavior change
until authors opt in.

## Risks and mitigations

- **Selector/marker-class drift** (low likelihood, low-to-medium severity):
  themes or widgets could rename the elements the module targets. Mitigation:
  no-op-when-absent design; real and synthetic E2E tests.
- **Overlay coverage gaps** (medium): a new overlay widget added without a probe
  would not suppress navigation. Mitigation: the documented one-entry
  `overlaySignals` extension pattern (ADR-0041) and the E2E template.
- **Author discoverability** (medium, low severity): the option may go unnoticed.
  Mitigation: descriptive properties-UI title and help text.

## Open questions

- Should a future iteration surface an in-page keyboard-shortcut help/legend for
  readers? Out of scope here.
- Should additional overlay widgets (e.g. future modal-style iDevices) be added
  to `overlaySignals` proactively, or only as they ship? Current choice: add on
  ship.

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Keyboard-navigation runtime lives in the shared export/preview runtime and drives existing theme elements | ADR-0039 | Proposed |
| Keyboard navigation is an opt-in, off-by-default export-metadata option threaded through the unified export pipeline | ADR-0040 | Proposed |
| Defer to open overlays via an extensible overlay-signal registry (active surface owns the keyboard) | ADR-0041 | Proposed |

## Evidence

- Runtime and registry: `public/app/common/exe_export.js` (`keyboardNav` lines
  558-800; `overlaySignals` lines 643-686; `isOverlayActive` lines 688-698;
  `handleKeydown` lines 758-799; init from `$exeExport.init()` line 45).
- Rendering: `src/shared/export/renderers/PageRenderer.ts` (lines 308-315, 1338;
  defaults 122, 269, 1271).
- Option plumbing: `src/shared/export/metadata-properties.ts` (175-181);
  `src/routes/config-params.ts` (358-365); `src/shared/export/interfaces.ts`
  (69, 677); `src/shared/export/adapters/YjsDocumentAdapter.ts` (110);
  `src/shared/export/exporters/Html5Exporter.ts` (455);
  `public/app/yjs/YjsPropertiesBinding.js` (66);
  `public/app/yjs/YjsProjectBridge.js` (1880).
- Tests: `src/shared/export/renderers/PageRenderer.spec.ts` (2048-2096);
  `src/shared/export/adapters/YjsDocumentAdapter.spec.ts` (302-326);
  `public/app/common/exe_export.test.js` (2387, 2565, 3127);
  `test/e2e/playwright/specs/preview-keyboard-navigation.spec.ts`;
  `test/e2e/playwright/specs/idevices/image-gallery.spec.ts` (517);
  `test/e2e/playwright/helpers/workarea-helpers.ts` (1327).
- Operational references (not duplicated here):
  [doc/elpx-format/metadata.md](../../elpx-format/metadata.md),
  [doc/elpx-format/export-pipeline.md](../../elpx-format/export-pipeline.md),
  [doc/architecture.md](../../architecture.md).

## Acceptance criteria

- [x] `addKeyboardNavigation` export option exists and defaults to `false`.
- [x] When enabled, exported and previewed pages emit
  `window.exeKeyboardNavEnabled=true` before `libs/exe_export.js`.
- [x] Arrow keys navigate pages; `m`/`Alt+M`, `Alt+/`, and `t` toggle menu,
  search, and Teacher Mode against existing theme elements.
- [x] Shortcuts never fire while typing/composing or while an overlay is open.
- [x] Per-visitor opt-out via `?keyboard-navigation=false` or localStorage.
- [x] Unit and E2E tests cover the runtime, the registry, and the default-off
  gate.

## Implementation checklist

- [x] Add `keyboardNav` module to `public/app/common/exe_export.js` and init it.
- [x] Add the `overlaySignals` registry and `isOverlayActive()` gate.
- [x] Declare `addKeyboardNavigation` in metadata-properties, interfaces, adapter,
  exporter, config-params, and the two frontend property maps.
- [x] Emit the inline flag from `PageRenderer.renderHead()` and
  `renderSinglePage()` before `exe_export.js`.
- [x] Add backend/shared unit tests, frontend unit tests, and E2E specs
  (preview + real lightbox), plus the `enableKeyboardNavigationOption` helper.

## References

- Issue #2019 — keyboard navigation request.
- PR #2020 — implementation; PR #2149 — follow-up.
- ADR-0039, ADR-0040, ADR-0041.
- Operational docs: `doc/elpx-format/metadata.md`,
  `doc/elpx-format/export-pipeline.md`, `doc/architecture.md`.
