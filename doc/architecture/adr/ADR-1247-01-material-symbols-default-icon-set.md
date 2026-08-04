---
id: ADR-1247-01
title: "Adopt Google Material Symbols as the default built-in block/iDevice icon set"
status: Proposed
date: 2026-07-09
tracking_issue: 1247
legacy_id: ADR-0013
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
  - "@mnunezcedec"
related:
  prs: [1497]
  changes: ["1247-material-icons-default-icon-system"]
  adrs: [ADR-1247-02, ADR-1247-03, ADR-1247-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1247-01: Adopt Google Material Symbols as the default built-in block/iDevice icon set

## Context

Every content block (box) in eXeLearning can display an icon in its header. Historically the only icons an author could choose came from the **active theme**: each theme ships a small, hand-drawn set under `theme/icons/` (for example `objectives.png`, `activity.svg`). This coupled the available iconography to whatever the selected theme happened to draw, so:

- The picker offered only a handful of icons, and the set changed when the author switched theme.
- Legacy pre-v3 icon ids (`info`, `warning`, `tip`, `activity`, `read`, `reflection`, `objectives`, `keypoints`) were the de-facto vocabulary, but not every theme provided artwork for them.
- There was no large, consistent, license-clean vocabulary of general-purpose icons available regardless of theme.

Issue #1247 asked for a richer, theme-independent icon library so authors can pick a meaningful icon for any block without depending on theme artwork. PR #1497 implements this by introducing a "General" icon group backed by a well-known third-party icon set, rendered alongside the existing theme ("Style") icons.

## Problem

Which icon set should become the default, always-available ("General") icon vocabulary for block/iDevice headers, shipped inside the product and usable regardless of the active theme?

## Decision drivers

- **License cleanliness** — eXeLearning is AGPL-3.0; any bundled asset set must carry a permissive, redistributable license.
- **Breadth and coverage** — authors need a large vocabulary covering education, media, UI and general concepts.
- **Visual consistency** — a single grid/weight so all icons look like one family, and so they can be tinted to match each theme.
- **Offline / self-contained** — the editor and every export (HTML5, SCORM, EPUB3, IMS) must work with no network and no external CDN.
- **Maintainability** — the set must be regenerable from an upstream package with a scripted, repeatable process.
- **Backward compatibility** — existing theme icons and legacy icon ids must keep working.

## Options considered

### Option 1: Keep theme-only icons (status quo)

Continue offering only the icons drawn by the active theme.

- Pros: zero new assets; no license surface; already tinted to the theme.
- Cons: tiny, inconsistent vocabulary; the available icons change when the theme changes; does not solve #1247; legacy ids are not guaranteed to resolve.

### Option 2: Google Material Symbols (chosen)

Vendor the Material Symbols outlined set (filled variant, weight 400) as the default "General" group, drawn on a uniform 24-grid so glyphs can be recolored per theme.

- Pros: ~3,800 icons covering nearly every concept; Apache-2.0 licensed (redistributable under AGPL); single visual family on one grid; monochrome path data that can be tinted with `currentColor`; distributed as an npm package (`@material-symbols/svg-400`) so the vendored copy is regenerable.
- Cons: adds a large asset to the repo/bundle (mitigated by ADR-1247-03, single sprite + on-demand extraction); glyphs live in a 20/24 live area, so they need a 1.2× optical scale to match edge-to-edge theme artwork.

### Option 3: Another open icon set (Font Awesome Free, Bootstrap Icons, Feather, Tabler…)

- Pros: also open-licensed; some are smaller.
- Cons: smaller vocabularies (hundreds, not thousands); mixed visual grids; Font Awesome Free splits its most useful icons into a paid tier. None matches Material Symbols on breadth + single-grid consistency for this use case.

## Evidence

- New default set is vendored from Material Symbols: the generator `scripts/generate-material-icons.js` reads `node_modules/@material-symbols/svg-400/outlined`, selects the filled variant (`*-fill.svg`) at weight 400, and emits both the sprite and a name catalog. Header comment documents the source and process.
- The dependency is declared in `package.json` as a devDependency: `"@material-symbols/svg-400": "^0.40.2"`.
- The generated catalog `public/app/workarea/project/idevices/content/materialIconCatalog.js` exports `MATERIAL_ICON_CATALOG` with 3,798 icon names (verified: the file is 3,800 lines; the sprite `public/libs/material-icons/material-icons.svg` contains 3,798 `<symbol>` entries).
- The license is vendored alongside the asset: `public/libs/material-icons/LICENSE`.
- The set is exposed as the "General" group in the block icon picker and rendered next to theme ("Style") icons — see `public/app/workarea/project/idevices/content/blockNode.js` (`createModalIconOption`, `renderMaterialSpriteIcon`, `renderMaterialMaskIcon`) and modal styling in `assets/styles/components/_modals.scss`.
- Legacy pre-v3 icon ids are mapped onto Material glyphs so existing content keeps a sensible icon: `LEGACY_ICON_MAP` in `public/app/workarea/project/idevices/content/blockNode.js` (`info→info`, `warning→warning`, `alert→warning`, `tip→lightbulb`, `activity→checklist`, `read→menu_book`, `reflection→chat`, `objectives→target`, `keypoints→bookmark`).
- Tests exist and cover this area: `public/app/workarea/project/idevices/content/blockNode.test.js`, `src/shared/material-icons/spriteParser.spec.ts`, `src/shared/block-icon.spec.ts`.

## Decision

We will adopt **Google Material Symbols** (outlined family, filled variant, weight 400) as the default, theme-independent "General" icon set for block/iDevice headers. The set is vendored into the repository from the `@material-symbols/svg-400` npm package via a scripted generator, ships under its Apache-2.0 license, and is offered in the picker alongside the active theme's "Style" icons. Existing theme icons and legacy icon ids continue to work.

## Consequences

### Positive

- Authors get a large, consistent, always-available icon vocabulary regardless of theme (resolves #1247).
- The set is regenerable from a pinned upstream package, so bumps are a scripted, reviewable operation.
- Monochrome glyph paths allow per-theme tinting (ADR-1247-04).

### Negative

- Adds a large vendored asset to the repository and to exports (mitigated by ADR-1247-03: a single sprite plus on-demand extraction rather than ~3,800 loose files).
- Introduces a build-time devDependency (`@material-symbols/svg-400`) that must be kept in sync with the vendored sprite/catalog.

### Neutral

- The icon vocabulary is now defined by two sources in the UI: theme "Style" icons and Material "General" icons; the picker groups them explicitly.
- Material Symbols glyphs need a 1.2× optical scale to visually match edge-to-edge theme artwork (a CSS concern handled in ADR-1247-04).

## Risks

- **Upstream drift**: a future `@material-symbols/svg-400` bump could rename or drop icons, changing the catalog. Mitigated because the vendored sprite/catalog are checked in and only change when the generator is re-run deliberately.
- **License compliance**: the Apache-2.0 `LICENSE` must remain vendored next to the asset; removing it would break redistribution terms.
- **Bundle size**: the full set is large; mitigated by ADR-1247-03.

## Validation

- The picker shows the "General" (Material) group and the "Style" (theme) group, and a chosen Material icon renders in the block header and survives save/reload — covered by `public/app/workarea/project/idevices/content/blockNode.test.js` and the E2E block-icon picker spec under `test/e2e/playwright/specs/`.
- Legacy icon ids resolve to the mapped Material glyph — covered in `blockNode.test.js`.
- Regenerating with `node scripts/generate-material-icons.js` reproduces the vendored sprite and catalog from the pinned package.

## Follow-up work

- Keep the vendored sprite/catalog in sync with `@material-symbols/svg-400` on dependency bumps (re-run the generator).
- See the change design for the end-to-end system design and the remaining follow-up items.

## References

- Issue #1247 — request for a richer, theme-independent block icon library.
- PR #1497 — implementation.
- the change design — Material Icons as the Default Block/iDevice Icon System.
- ADR-1247-02 — structured block-icon descriptor with legacy `iconName` compatibility.
- ADR-1247-03 — single sprite with on-demand extraction.
- ADR-1247-04 — dual icon rendering and per-theme tint.
- `scripts/generate-material-icons.js`, `public/libs/material-icons/material-icons.svg`, `public/libs/material-icons/LICENSE`, `public/app/workarea/project/idevices/content/materialIconCatalog.js`, `package.json`.
