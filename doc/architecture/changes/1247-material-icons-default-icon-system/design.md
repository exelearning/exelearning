---
tracking_issue: 1247
title: "Material Icons as the Default Block/iDevice Icon System"
status: implemented
date: 2026-07-09
legacy_id: SDD-0003
authors:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
  - "@mnunezcedec"
implementation_prs: [1497]
related_adrs: [ADR-1247-01, ADR-1247-02, ADR-1247-03, ADR-1247-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# Material Icons as the Default Block/iDevice Icon System — design

## Summary

Every content block (box) can show an icon in its header. This design adds a large, theme-independent "General" icon vocabulary — Google Material Symbols — alongside each theme's own "Style" icons, so authors can pick a meaningful icon for any block regardless of the active theme (issue #1247). To keep the repository, editor bundle and exports lean, the ~3,800-icon set ships as a single on-disk sprite that is parsed once and from which only the icons a project uses are extracted on demand. A structured `{ source, value }` icon descriptor replaces ad-hoc string sniffing, and icons render with a technique chosen per source: monochrome Material glyphs are CSS-masked and tinted per theme; theme and asset icons render as plain images. The behaviour is identical in the editor, the picker, and in every export format (HTML5, SCORM 1.2/2004, EPUB3, IMS, single page, ELPX).

## Problem statement

Block icons were limited to whatever the active theme drew under `theme/icons/`. The set was small and changed when the author switched theme; legacy pre-v3 ids were not guaranteed to resolve; and there was no consistent, license-clean, theme-independent icon vocabulary. Educators authoring for a broad audience need a large, predictable icon set they can rely on regardless of theme.

## Goals

- Offer a large, always-available, theme-independent icon vocabulary in the block icon picker.
- Keep the repository, static editor bundle and exports small despite ~3,800 icons.
- Represent an icon's kind explicitly so rendering, tinting and export bundling branch cleanly.
- Preserve backward compatibility: existing theme icons, asset icons and legacy `iconName`-only content keep working.
- Render icons identically in the editor, the picker and every export, fully offline.
- Tint Material glyphs to match each theme; leave theme/asset artwork untouched.

## Non-goals

- Replacing theme "Style" icons or removing per-theme artwork (both remain first-class).
- Recoloring multi-hued theme/asset icons.
- Redesigning the export pipeline, ELP/ELPX format, or the Yjs document model beyond the block-icon field.
- Shipping the full icon set into every export (only used icons are embedded).

## Current state

Operational documentation for the surrounding systems already exists; this SDD does not restate it and instead links to it:

- Blocks and page structure — [doc/elpx-format/pages-blocks.md](../../elpx-format/pages-blocks.md)
- Themes and theme icons — [doc/elpx-format/themes.md](../../elpx-format/themes.md), [doc/development/styles.md](../../development/styles.md)
- Export pipeline — [doc/elpx-format/export-pipeline.md](../../elpx-format/export-pipeline.md)
- Bundled libraries under `libs/` — [doc/elpx-format/libraries.md](../../elpx-format/libraries.md)
- Overall architecture and client-is-source-of-truth model — [doc/architecture.md](../../architecture.md)
- Agent/build/test conventions — [AGENTS.md](../../../AGENTS.md)

Before PR #1497, a block icon was a single overloaded `iconName` string, and each consumer (server export route, shared export renderer, Yjs structure binding) re-sniffed its shape to decide what kind of icon it was. Icons were resolved only against the active theme's `theme/icons/` files.

## Proposed design

Implemented in PR #1497. Four durable decisions underpin it (see "ADRs required or referenced"):

1. **Default set (ADR-1247-01):** vendor Material Symbols (outlined, filled, weight 400) as the "General" group, generated from the `@material-symbols/svg-400` npm package.
2. **Data model (ADR-1247-02):** a structured `{ source, value }` descriptor with `source ∈ {material, asset, theme, none}`, kept coherent with a legacy `iconName` mirror, derived by one shared `deriveBlockIcon()` function.
3. **Delivery (ADR-1247-03):** a single sprite (`material-icons.svg`) parsed once; only the icons a project uses are extracted on demand, in both the editor and exports.
4. **Rendering (ADR-1247-04):** CSS-masked `currentColor` glyphs for Material icons (tinted per theme, scaled 1.2×); `<img>` for theme/asset icons.

## User experience

- The author clicks a block's header icon to open the "Select icon" modal. The modal shows two groups: **Style** (the active theme's icons) and **General** (Material Symbols), plus an **Image** option to choose an asset from the file manager, and a "No icon" option.
- A search box filters the (large) General group by name.
- The chosen icon appears immediately in the block header, tinted to the theme, and is persisted via Yjs; it survives reload and appears identically in previews and exports.
- Legacy content whose blocks used pre-v3 ids (`tip`, `objectives`, …) shows a sensible Material glyph via a legacy map, unless the active theme provides that icon (then the theme icon wins).

## Technical design

Data model and derivation (ADR-1247-02):

- `src/shared/block-icon.ts` — `deriveBlockIcon(iconName) → { source, value }`; `BlockIconSource = 'material' | 'asset' | 'theme' | 'none'`. Single source of truth for string → descriptor.
- JS twins: `public/app/common/blockIconRuntime.js` (`deriveBlockIcon`) and a mirror in `public/app/workarea/project/idevices/content/blockNode.js` (`normalizeIconDescriptor`, `LEGACY_ICON_MAP`).
- Export contract: `ExportBlock.icon?: { source, value }` + `iconName?` in `src/shared/export/interfaces.ts`.
- Yjs shape: `BlockIconDescriptor` in `src/yjs/types.ts`; stored/read/kept-coherent in `src/yjs/structure-binding.ts` (`createYjsBlockIcon`, `toBlockIconDescriptor`, `updateBlock` mirrors `icon`↔`iconName`).
- Server export route: `src/routes/export.ts` uses `block.icon || deriveBlockIcon(block.iconName)`.

Icon set generation and storage (ADR-1247-01, ADR-1247-03):

- `scripts/generate-material-icons.js` reads `@material-symbols/svg-400/outlined` (`*-fill.svg`, weight 400) and writes the sprite `public/libs/material-icons/material-icons.svg` (3,798 `<symbol>` entries, ~1.6 MB) and the catalog `public/app/workarea/project/idevices/content/materialIconCatalog.js` (`MATERIAL_ICON_CATALOG`, 3,798 names). `public/libs/material-icons/LICENSE` is vendored alongside. Dependency pinned in `package.json` (`@material-symbols/svg-400: ^0.40.2`).

Sprite parsing and on-demand extraction (ADR-1247-03):

- Shared parser `src/shared/material-icons/spriteParser.ts` — `parseMaterialIconSprite`, `resolveMaterialIconSymbol`, `buildStandaloneSvg`, `getMaterialIconSvg`, `getMaterialIconDataUri`, `MATERIAL_ICON_FALLBACK='help'`, `HELP_ICON_FALLBACK_DATA_URI`.
- Export side: `src/shared/export/exporters/BaseExporter.ts` — `collectUsedMaterialIconNames(pages)` + `resolveMaterialIconDataUris(resources, pages)` fetch the sprite once, extract only used icons, and return `{ paths, files, dataUris }`. Every exporter calls it: `Html5Exporter`, `Scorm12Exporter`, `Scorm2004Exporter`, `Epub3Exporter`, `PageExporter`, `PrintPreviewExporter`, `ElpxExporter` (and `ImsExporter`, which extends `Html5Exporter`). The file-based exporters (HTML5, SCORM 1.2/2004, single page, ELPX) write reconstructed files under `libs/` and pass `dataUris` into rendering; `Epub3Exporter` and `PrintPreviewExporter` embed the glyphs as inline `data:` URIs only.
- Editor side: `public/app/common/blockIconRuntime.js` parses the sprite once (JS twin), caches per-icon `data:` URIs, and hydrates placeholders. The sprite is fetched lazily by `public/app/yjs/YjsProjectBridge.js` (`loadMaterialSprite`), and deliberately excluded from bulk base-library maps in `public/app/yjs/ResourceFetcher.js`.

Rendering and tinting (ADR-1247-04):

- Export renderer `src/shared/export/renderers/IdeviceRenderer.ts` (`renderBlock`) branches on `icon.source`: `material` → `<span class="exe-material-icon" style="--exe-material-icon-url:url('<data URI>')" aria-hidden="true">`; `asset`/`theme` → `<img>`.
- CSS mask + `currentColor` fill + `1.2×` scale in `assets/styles/layout/_execontent.scss`, `assets/styles/components/_modals.scss`, exported theme CSS `public/files/perm/themes/base/*/style.css`, and `public/style/workarea/base.css`.
- Per-theme tint via `--exe-icon-color` / `--icon-primary` / `--modal-icon-color` with `THEME_ICON_COLOR_MAP` fallback and default `#6E9F41` (`blockNode.js` `getCurrentThemeIconColor`; default var in `assets/styles/abstracts/_variables.scss`). The picker browses Material icons via a sprite `<use>` variant (`renderMaterialSpriteIcon`) while applied icons use the mask `data:` URI (`renderMaterialMaskIcon`).

## Data model

- **Yjs block map** (`src/yjs/structure-binding.ts`, `src/yjs/types.ts`): adds `icon` as a nested `Y.Map` with `source`, `value`, optional `name`; keeps legacy `iconName` string coherent (material → `mi-<value>`).
- **Export block** (`src/shared/export/interfaces.ts`): `icon?: { source, value }` plus `iconName?`.
- **On-disk assets**: single sprite `public/libs/material-icons/material-icons.svg` (name-keyed `<symbol>`s); name catalog `materialIconCatalog.js`. No loose per-icon files (removed).
- **Export package**: for file-based exporters, reconstructed `libs/material-icons/icons/{name}.svg` for used icons (matching the shape of the removed loose files) plus inline `data:` URIs in the HTML; EPUB3 and print preview inline the `data:` URIs only.

## Migration and compatibility

- **Legacy `iconName`-only content** (older projects, ELP/ELPX): `deriveBlockIcon()` reconstructs the descriptor at read time; the export route and structure binding back-fill `icon` from `iconName`. No data migration step is required.
- **Legacy pre-v3 ids**: mapped to Material glyphs via `LEGACY_ICON_MAP` (`blockNode.js`), but the active theme's own icon takes precedence when it provides that id.
- **Theme icons and asset icons**: unchanged; still rendered as `<img>`.
- **Removed loose SVG files**: superseded by the sprite; the export output path/shape is preserved so downstream consumers are unaffected. Client base-library fetching skips `material-icons/` because the sprite is fetched on demand.

## Security and privacy

- Icon SVGs are vendored, static, monochrome path data generated from a pinned package; no user input is embedded in the sprite. No PII.
- Material icon names are constrained to the catalog before use (`sanitizeMaterialIconName` in `blockIconRuntime.js`; catalog membership check in `renderMaterialSpriteIcon`), and pending placeholder names are stripped to `[a-z0-9_-]`.
- Asset icon URLs continue to flow through the existing asset-URL transformation/escaping in `IdeviceRenderer` (`fixAssetUrls`, `escapeAttr`); this design adds no new network fetches to exports (fully self-contained `data:` URIs).

## Accessibility

- Decorative Material glyph spans carry `aria-hidden="true"`; asset icons render as `<img alt="…">`.
- The picker exposes options as focusable elements with titles/labels (`createModalIconOption`, `aria-label` on the header icon button in `blockNode.js`).
- Tinting draws from theme color variables so contrast tracks the theme; the originally selected option keeps a visible outline (`original-icon-selection`, `_modals.scss`).

## Internationalization

- User-facing strings use the existing `_()` helper (e.g. `_('Select icon')`, `_('Search icon')`, `_('Image')`, `_('No icon')` in `blockNode.js`). No new content strings are introduced into `translations/` by this SDD; per project rule, XLF changes are out of scope.

## Performance

- The single sprite (~1.6 MB) is fetched once by the editor, lazily, and parsed once into an in-memory map with a per-icon `data:` URI cache (`blockIconRuntime.js`), versus per-icon HTTP requests under the removed loose-file layout.
- Exports embed only the icons a project references (`collectUsedMaterialIconNames`), so export size scales with usage, not with the full set.
- Parsing is regex-based and tolerant; failures degrade to the `help` fallback rather than throwing.

## Testing strategy

- Backend/shared unit (`bun test`): `src/shared/block-icon.spec.ts`, `src/shared/material-icons/spriteParser.spec.ts`, `src/shared/export/exporters/BaseExporter.spec.ts`, `src/shared/export/renderers/IdeviceRenderer.spec.ts`, per-exporter specs (`Html5Exporter.spec.ts`, `Scorm12Exporter.spec.ts`, `Scorm2004Exporter.spec.ts`, `Epub3Exporter.spec.ts`, `PageExporter.spec.ts`, `PrintPreviewExporter.spec.ts`), `src/yjs/structure-binding.spec.ts`.
- Frontend unit (`vitest`): `public/app/common/blockIconRuntime.test.js`, `public/app/workarea/project/idevices/content/blockNode.test.js`.
- E2E (`playwright`): block-icon picker flow under `test/e2e/playwright/specs/` (the branch also adjusts helpers to leave iDevice edition before opening the picker).
- Coverage gate ≥ 90% on changed lines per AGENTS.md.

## Rollout plan

- Shipped as a single feature branch/PR (#1497). No feature flag: the picker simply gains the "General" group; legacy content is handled transparently by `deriveBlockIcon()`.
- The generator (`scripts/generate-material-icons.js`) is run only when bumping the icon set.

## Risks and mitigations

- **TS/JS twin drift** (`block-icon.ts` vs `blockIconRuntime.js`; `spriteParser.ts` vs the JS parser) → mirrored tests and in-code "keep in sync" comments.
- **Upstream package drift** on bumps → sprite/catalog are checked in and regenerated deliberately; pinned version.
- **CSS mask unsupported** on old engines → graceful degradation to a solid tinted block.
- **Descriptor/legacy skew** → all writes funnel through `structure-binding.updateBlock`, which updates both fields.
- **Sprite fetch failure** in the editor → placeholder hydration once loaded; export uses the `help` `data:` URI fallback.

## Open questions

- Should the TS→JS twins be generated to remove manual sync? (Deferred.)
- Should multi-hued themes get a multi-stop tint or per-theme colored Material variants instead of keeping the accent? (Deferred; weighed against ADR-1247-03's single-copy goal.)
- Should the `1.2×` optical-scale constant and mask CSS be consolidated into one shared partial? (Deferred.)

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Adopt Google Material Symbols as the default "General" icon set | ADR-1247-01 | Proposed |
| Structured `{ source, value }` block-icon descriptor with legacy `iconName` compatibility | ADR-1247-02 | Proposed |
| Ship Material icons as a single sprite with on-demand extraction | ADR-1247-03 | Proposed |
| Dual icon rendering (masked Material glyphs vs `<img>` style/asset) with per-theme tint | ADR-1247-04 | Proposed |

## Evidence

Operational docs (linked, not duplicated): [doc/elpx-format/pages-blocks.md](../../elpx-format/pages-blocks.md), [doc/elpx-format/themes.md](../../elpx-format/themes.md), [doc/elpx-format/export-pipeline.md](../../elpx-format/export-pipeline.md), [doc/elpx-format/libraries.md](../../elpx-format/libraries.md), [doc/architecture.md](../../architecture.md), [doc/development/styles.md](../../development/styles.md), [AGENTS.md](../../../AGENTS.md).

Implementation (PR #1497) — verified code paths:

- Data model / derivation: `src/shared/block-icon.ts`, `src/shared/export/interfaces.ts`, `src/yjs/types.ts`, `src/yjs/structure-binding.ts`, `src/routes/export.ts`, `public/app/common/blockIconRuntime.js`, `public/app/workarea/project/idevices/content/blockNode.js`.
- Icon set: `scripts/generate-material-icons.js`, `public/libs/material-icons/material-icons.svg`, `public/libs/material-icons/LICENSE`, `public/app/workarea/project/idevices/content/materialIconCatalog.js`, `package.json`.
- Extraction: `src/shared/material-icons/spriteParser.ts`, `src/shared/export/exporters/BaseExporter.ts` and the exporters `Html5Exporter.ts`, `Scorm12Exporter.ts`, `Scorm2004Exporter.ts`, `Epub3Exporter.ts`, `PageExporter.ts`, `PrintPreviewExporter.ts`, `ElpxExporter.ts`; client fetch in `public/app/yjs/YjsProjectBridge.js` and exclusion in `public/app/yjs/ResourceFetcher.js`.
- Rendering / tint: `src/shared/export/renderers/IdeviceRenderer.ts`, `assets/styles/layout/_execontent.scss`, `assets/styles/components/_modals.scss`, `assets/styles/abstracts/_variables.scss`, `public/files/perm/themes/base/*/style.css`, `public/style/workarea/base.css`.
- Tests: `src/shared/block-icon.spec.ts`, `src/shared/material-icons/spriteParser.spec.ts`, `src/shared/export/exporters/BaseExporter.spec.ts`, `src/shared/export/renderers/IdeviceRenderer.spec.ts`, `src/yjs/structure-binding.spec.ts`, `public/app/common/blockIconRuntime.test.js`, `public/app/workarea/project/idevices/content/blockNode.test.js`.

## Acceptance criteria

- [x] The block icon picker shows a theme-independent "General" (Material) group plus the theme "Style" group and an asset "Image" option.
- [x] A chosen Material icon renders in the block header, tinted to the theme, and survives save/reload.
- [x] Legacy `iconName`-only content and pre-v3 ids resolve to a sensible icon without a migration step.
- [x] Exports embed only the Material icons a project uses, fully offline (inlined `data:` URIs, plus reconstructed `libs/` files for file-based formats).
- [x] Icon kind is represented explicitly and derived by one shared function used by every consumer.
- [x] Material glyphs are CSS-masked/`currentColor`; theme/asset icons render as `<img>`.

## Implementation checklist

- [x] Add `@material-symbols/svg-400` devDependency and `scripts/generate-material-icons.js`.
- [x] Generate the single sprite + name catalog; vendor the LICENSE; remove loose per-icon files.
- [x] Add shared parser `spriteParser.ts` (+ JS twin) and `deriveBlockIcon()` (+ JS twins).
- [x] Add the structured `icon` descriptor to the export contract and the Yjs shape; keep `iconName` coherent.
- [x] Wire on-demand extraction into `BaseExporter` and every exporter; lazy sprite fetch in the editor.
- [x] Implement dual rendering + per-theme tint + optical scale in renderer and CSS (editor, picker, exported themes).
- [x] Extend the picker UI with the "General" group, search, and the legacy id map.
- [x] Add unit tests (backend + frontend) and the E2E picker spec.

## References

- Issue #1247, PR #1497 (implementation), PR #2149 (ADR/SDD documentation infrastructure).
- ADR-1247-01, ADR-1247-02, ADR-1247-03, ADR-1247-04.
- Operational docs and code/test paths listed under Evidence.
