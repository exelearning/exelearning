---
id: ADR-1247-04
title: "Dual icon rendering: currentColor-masked Material glyphs vs img style/asset icons, tinted per theme"
status: Proposed
date: 2026-07-09
tracking_issue: 1247
legacy_id: ADR-0016
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
  - "@mnunezcedec"
related:
  prs: [1497]
  changes: ["1247-material-icons-default-icon-system"]
  adrs: [ADR-1247-01, ADR-1247-02, ADR-1247-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1247-04: Dual icon rendering: currentColor-masked Material glyphs vs img style/asset icons, tinted per theme

## Context

Block headers now render icons from three sources (ADR-1247-02): Material "General" glyphs, theme "Style" icons, and author-supplied asset images. These have fundamentally different coloring semantics:

- **Material glyphs** are monochrome path data. To look like they belong to a theme, they must be recolored to match that theme's accent — a single tint applied to the glyph ink.
- **Theme "Style" icons and asset images** are already-colored raster/vector artwork (often multi-hued). They must be drawn as-is; tinting them would destroy them.

So a single rendering technique cannot serve all three. The design must pick a technique per source, and it must tint Material glyphs per theme so the "General" group looks visually consistent with each theme's own "Style" icons — in the picker, in the editor content, and in every export.

## Problem

How should each icon source be rendered in HTML/CSS, and how should Material glyphs be tinted so they match the active theme in the editor and in exports, without recoloring theme/asset artwork?

## Decision drivers

- **Per-theme visual consistency** — Material glyphs must adopt each theme's accent color.
- **Preserve colored artwork** — theme "Style" icons and asset images must render with their own colors.
- **Offline / self-contained** — coloring must work with no runtime JS in exports (pure CSS), from inlined `data:` URIs.
- **Optical parity** — Material Symbols occupy a 20/24 live area; they must be scaled to match edge-to-edge theme artwork.
- **Accessibility** — decorative icons must be hidden from assistive tech.

## Options considered

### Option 1: One technique for all sources (e.g. always `<img>`, or always inline SVG)

- Pros: simplest rendering branch.
- Cons: `<img>` cannot be recolored per theme, so Material glyphs could not adopt the theme accent; inline-recoloring theme/asset artwork would destroy multi-hued icons. Rejected.

### Option 2: Dual rendering — CSS-mask for Material, `<img>` for style/asset (chosen)

Render Material glyphs as a masked element whose fill is `currentColor` and whose `mask-image` is the glyph's inlined `data:` URI, so the glyph ink takes the surrounding `color`. Render theme "Style" icons and asset images as plain `<img>` so they keep their own colors. Tint Material glyphs per theme by setting `color`/`currentColor` from the theme (via CSS variables and per-theme fallbacks).

- Pros: Material glyphs adopt any theme color via one CSS property; colored artwork is untouched; works in exports with zero JS (pure CSS mask + inlined `data:` URI); one masking CSS shared by editor, picker and exports.
- Cons: CSS mask needs vendor prefixes; multi-hued themes cannot be matched by a single tint, so those keep the theme accent; the 20/24 live area needs a 1.2× optical scale.

### Option 3: Recolor Material SVGs at generation/paint time (bake per-theme colored copies)

- Pros: no runtime masking.
- Cons: multiplies stored/exported assets per theme; defeats ADR-1247-03's single-copy goal; still cannot handle arbitrary theme colors. Rejected.

## Evidence

- **Material glyph rendering (mask + currentColor)**: the export renderer emits `<span class="exe-material-icon" style="--exe-material-icon-url:url('<data URI>');" aria-hidden="true">` inside `<div class="box-icon exe-icon">` — `src/shared/export/renderers/IdeviceRenderer.ts` (`renderBlock`, `icon.source === 'material'`). The editor runtime emits the same markup: `renderMaterialMaskIcon` in `public/app/common/blockIconRuntime.js` (and `MATERIAL_ICON_MASK_STYLE`).
- **CSS mask + currentColor fill**: `.exe-material-icon { background-color: currentColor; mask-image: var(--exe-material-icon-url); … }` in `assets/styles/layout/_execontent.scss` (editor content) and mirrored in the exported theme CSS, e.g. `public/files/perm/themes/base/neo/style.css` and `.../base/base/style.css` (`.exe-export .box-icon .exe-material-icon`). The editor workarea build carries the same rule at `public/style/workarea/base.css`.
- **`<img>` for asset and theme icons**: `IdeviceRenderer.renderBlock` renders `icon.source === 'asset'` and the theme branch as `<img src="…" alt="" style="display:block;object-fit:contain;">`. In the editor, `blockNode.js` `renderIconPreviewHtml` renders assets as `<img>` and theme icons via `makeIconValueElement` (an `<img>`).
- **Per-theme tint**: Material glyphs inherit the surrounding `color`. In the editor, `blockNode.js` `getCurrentThemeIconColor()` reads `--exe-icon-color` / `--icon-primary` / computed `color`, with a `THEME_ICON_COLOR_MAP` fallback (`base #d86e41`, `flux #eda900`, `nova #f5c200`, `neo #e3ac3b`, `zen #d40055`, `universal #0d2953`) and a default `#6E9F41`. The comment records that multicolor themes (neo, universal) keep the theme accent because a single tint cannot match multi-hued style icons. The picker uses `--modal-icon-color` / `--icon-primary` (`assets/styles/components/_modals.scss`); the default `--icon-primary: #6E9F41` is in `assets/styles/abstracts/_variables.scss`.
- **Optical scale**: `.exe-material-icon { transform: scale(1.2); }` with a comment explaining Material Symbols fill only their 20/24 (~83.3%) live area, so 24/20 = 1.2 matches edge-to-edge Style icons — `assets/styles/layout/_execontent.scss`, `assets/styles/components/_modals.scss`, and the exported theme CSS.
- **Picker uses a sprite `<use>` variant**: in the modal, Material options render via `renderMaterialSpriteIcon` (`<svg class="exe-material-icon-sprite"><use href="…/material-icons.svg#<name>">`, styled with `fill: currentColor`) while applied/content icons use the mask `data:` URI (`renderMaterialMaskIcon`) — `public/app/workarea/project/idevices/content/blockNode.js`, styled in `_modals.scss`.
- **Accessibility**: masked Material spans carry `aria-hidden="true"`; asset `<img>` carry `alt`.
- **Fallbacks**: when an icon name is unknown or the sprite is unavailable, the renderer inlines the `help` glyph (`HELP_ICON_FALLBACK_DATA_URI`, `MATERIAL_ICON_FALLBACK`) — `src/shared/export/renderers/IdeviceRenderer.ts`, `src/shared/material-icons/spriteParser.ts`.
- Tests: `src/shared/export/renderers/IdeviceRenderer.spec.ts` and `public/app/workarea/project/idevices/content/blockNode.test.js`.

## Decision

We will render block icons with **two techniques chosen per source**: Material "General" glyphs render as a `<span class="exe-material-icon">` whose `background-color` is `currentColor` and whose `mask-image` is the glyph's inlined `data:` URI, so the glyph ink takes the surrounding `color`; theme "Style" icons and author asset images render as plain `<img>` preserving their own colors. Material glyphs are **tinted per theme** by driving `color`/`currentColor` from theme CSS variables (`--exe-icon-color` / `--icon-primary` / `--modal-icon-color`) with per-theme fallbacks, and are scaled `1.2×` to optically match edge-to-edge theme artwork; multi-hued themes keep the theme accent. This works identically in the editor, the picker, and in exports (pure CSS mask over an inlined `data:` URI, no runtime JS).

## Consequences

### Positive

- Material glyphs adopt any theme's accent color via a single CSS property, matching the "Style" group.
- Theme and asset artwork render untouched with their own colors.
- Coloring works offline in every export with no JavaScript (CSS mask + inlined `data:` URI).
- One masking CSS and one optical-scale constant are shared by editor, picker and exports.

### Negative

- CSS `mask-image` requires `-webkit-` prefixes and is unavailable on very old engines (the mask degrades to a `currentColor` block rather than the glyph).
- Multi-hued themes (neo, universal) cannot be matched by a single tint and instead keep the theme accent — an intentional compromise.
- The 20/24 → 1.2× scale is a hand-tuned constant duplicated across the editor and exported theme CSS.

### Neutral

- The picker deliberately uses a sprite `<use>` reference for browsing while applied icons use the mask `data:` URI — two Material variants coexist for different jobs.

## Risks

- **Mask support gaps**: browsers without CSS mask show a solid tinted block. Low risk on supported targets; acceptable as graceful degradation.
- **Scale-constant drift**: the `1.2` factor lives in several CSS files; a change must be applied everywhere. Mitigated by shared comments documenting the 24/20 rationale.
- **Tint mismatch on custom themes**: a theme that sets neither `--exe-icon-color` nor `--icon-primary` and is not in `THEME_ICON_COLOR_MAP` falls back to `#6E9F41`. Acceptable default.

## Validation

- Export HTML for a Material icon contains the masked `<span class="exe-material-icon">` with an inlined `data:` URI and `aria-hidden` — `src/shared/export/renderers/IdeviceRenderer.spec.ts`.
- Asset and theme icons render as `<img>` with their own `src` — same spec.
- The editor tints Material glyphs to the active theme color and scales them to match Style icons — `public/app/workarea/project/idevices/content/blockNode.test.js` and the block-icon-picker E2E spec.

## Follow-up work

- If more multi-hued themes appear, consider a per-theme multi-stop tint or per-theme colored Material variants (weighed against ADR-1247-03's single-copy goal).
- Consolidate the `1.2×` scale and mask CSS into a single shared partial to avoid drift.
- See the change design for the full design and remaining follow-up items.

## References

- PR #1497, Issue #1247, the change design.
- ADR-1247-01 (Material Symbols default set), ADR-1247-02 (structured descriptor), ADR-1247-03 (single sprite).
- `src/shared/export/renderers/IdeviceRenderer.ts` (+ `.spec.ts`), `public/app/common/blockIconRuntime.js`, `public/app/workarea/project/idevices/content/blockNode.js` (+ `.test.js`), `assets/styles/layout/_execontent.scss`, `assets/styles/components/_modals.scss`, `assets/styles/abstracts/_variables.scss`, `public/files/perm/themes/base/*/style.css`, `src/shared/material-icons/spriteParser.ts`.
