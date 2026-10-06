---
id: ADR-1247-03
title: "Ship Material icons as a single sprite with on-demand extraction"
status: Proposed
date: 2026-07-09
tracking_issue: 1247
legacy_id: ADR-0015
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
  - "@mnunezcedec"
related:
  prs: [1497]
  changes: ["1247-material-icons-default-icon-system"]
  adrs: [ADR-1247-01, ADR-1247-02, ADR-1247-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1247-03: Ship Material icons as a single sprite with on-demand extraction

## Context

Adopting Material Symbols (ADR-1247-01) means vendoring ~3,800 icons into the repository and making them available to both the editor and every export format (HTML5, SCORM 1.2/2004, EPUB3, IMS, single-page, ELPX). A project only ever uses a handful of these icons.

The naive approach — one loose `.svg` file per icon under `public/libs/material-icons/icons/` — was tried and then removed: shipping ~3,800 tiny files bloated the static editor bundle and the repository, and every export had to decide which loose files to copy. The design in PR #1497 replaces the loose files with a single sprite and extracts only what is needed, on demand, at both the editor runtime and export time.

## Problem

How should the ~3,800-icon Material set be stored on disk and delivered to the editor and to exports, so that the repository/bundle stay small, a project embeds only the icons it actually uses, and there is exactly one on-disk copy of the icon data?

## Decision drivers

- **Repository / bundle size** — ~3,800 loose files inflate the static build and the git tree.
- **Export weight** — an export should embed only the icons a project uses, not the whole set.
- **Single source of truth** — one on-disk copy of the icon data, parsed by one shared parser.
- **Offline / self-contained** — no CDN; the sprite ships in the app and exports.
- **Regenerability** — the on-disk artifact must be reproducible from the upstream package.

## Options considered

### Option 1: Loose per-icon SVG files (superseded)

Ship every icon as `public/libs/material-icons/icons/{name}.svg`; exporters copy the used files.

- Pros: trivial to reference (`icons/{name}.svg`); no parsing.
- Cons: ~3,800 tiny files bloat the static editor bundle and the repository; every export must resolve/copy individual files; large git churn on every icon-set bump. This approach was implemented and then **removed** in favour of Option 2 — the code and generator comments explicitly document that the loose per-icon SVG files were removed because shipping ~3,800 tiny files bloated the static editor bundle and the repository.

### Option 2: Single sprite + on-demand extraction (chosen)

Ship one sprite file (`material-icons.svg`) containing every icon as an SVG `<symbol>`. Parse it once into memory and rebuild just the icons needed: the editor rebuilds a `data:` URI per used icon; exporters collect the icons a project references, parse the sprite, and emit reconstructed standalone SVGs (matching the shape of the removed loose files) and/or inline `data:` URIs, depending on the format.

- Pros: one on-disk copy; small git/bundle footprint versus thousands of files; exports embed only used icons; the export path keeps a stable `material-icons/icons/{name}.svg` output shape while sourcing bytes from the sprite; one shared parser (TS) with a JS twin.
- Cons: needs a parser and an in-memory index; a name absent from the sprite must fall back to a real glyph (there is no loose file to point at).

### Option 3: A web font (icon font) or the Material Symbols variable font

- Pros: compact single file; CSS-driven.
- Cons: ligature/codepoint mapping and font loading complicate offline exports and per-glyph tinting; harder to reconstruct an individual standalone SVG for the export package; larger accessibility/rendering surface. Not chosen.

## Evidence

- One sprite is the only on-disk copy: `public/libs/material-icons/material-icons.svg` (~1.6 MB, 3,798 `<symbol>` entries). Its shape is `<svg style="display:none"><symbol id="…" viewBox="0 -960 960 960"><path …/></symbol>…</svg>`.
- The generator produces the sprite and the name catalog from the npm package and documents the rationale: `scripts/generate-material-icons.js` ("eXeLearning ships the Material icon set as a SINGLE sprite … plus a name catalog … The loose per-icon SVG files were removed").
- Shared parser (single source of truth): `src/shared/material-icons/spriteParser.ts` — `parseMaterialIconSprite(text) → Map<name, {viewBox, body}>`, `resolveMaterialIconSymbol(...)` with `MATERIAL_ICON_FALLBACK = 'help'`, `buildStandaloneSvg(...)`, `getMaterialIconSvg(...)`, `getMaterialIconDataUri(...)`, and a literal `help` glyph + `HELP_ICON_FALLBACK_DATA_URI` for total-failure fallback.
- Export-side on-demand extraction: `src/shared/export/exporters/BaseExporter.ts` — `collectUsedMaterialIconNames(pages)` gathers the distinct icons a project references (from `block.icon.value` or legacy `mi-…` `iconName`), and `resolveMaterialIconDataUris(resources, pages)` fetches the sprite once (`MATERIAL_ICON_SPRITE_PATH = 'material-icons/material-icons.svg'`), parses it, and returns `{ paths, files, dataUris }` where `files` are reconstructed `material-icons/icons/{name}.svg` bytes and `dataUris` are inline `data:` URIs. Unknown names fall back to the `help` symbol so there is never a dangling reference.
- Every exporter uses it: `Html5Exporter`, `Scorm12Exporter`, `Scorm2004Exporter`, `Epub3Exporter`, `PageExporter`, `PrintPreviewExporter`, and `ElpxExporter` all call `resolveMaterialIconDataUris(...)` (and `ImsExporter` inherits the behaviour by extending `Html5Exporter`). The file-based exporters — `Html5Exporter`, `Scorm12Exporter`, `Scorm2004Exporter`, `PageExporter`, `ElpxExporter` — also write the reconstructed files under `libs/` (`addPrefixedFiles(materialIconFiles, 'libs/', …)`); `Epub3Exporter` and `PrintPreviewExporter` capture only the `dataUris` and embed the glyphs inline (no reconstructed `libs/material-icons/icons/*.svg` files).
- Editor-side on-demand extraction: `public/app/common/blockIconRuntime.js` parses the sprite once (`parseMaterialIconSprite`, JS twin of the TS parser), caches per-icon `data:` URIs (`getMaterialIconDataUri`), and hydrates placeholders (`hydrateMaterialIcons`). The sprite is fetched lazily by `public/app/yjs/YjsProjectBridge.js` (`loadMaterialSprite(spriteText, { root: document })`, fetching `material-icons/material-icons.svg`).
- The base-library delivery deliberately excludes the sprite from bulk library maps because it is fetched on demand: `public/app/yjs/ResourceFetcher.js` drops any `material-icons/` entries ("The Material Symbols sprite is fetched on demand by the icon runtime, never bundled with the base libraries").
- Tests: `src/shared/material-icons/spriteParser.spec.ts`, `src/shared/export/exporters/BaseExporter.spec.ts`, and the per-exporter specs (`Html5Exporter.spec.ts`, `Scorm12Exporter.spec.ts`, `Scorm2004Exporter.spec.ts`, `Epub3Exporter.spec.ts`, `PageExporter.spec.ts`, `PrintPreviewExporter.spec.ts`).

## Decision

We will ship the Material Symbols set as **one on-disk sprite file** (`public/libs/material-icons/material-icons.svg`, symbols keyed by icon name) generated from the pinned npm package, and **extract only the icons a project uses, on demand**. The editor parses the sprite once into memory and rebuilds a `data:` URI per used icon; the export pipeline collects referenced icon names, parses the sprite, and emits reconstructed standalone SVGs (matching the shape of the removed loose files) and/or inline `data:` URIs, depending on the format. Parsing lives in one shared TypeScript module (`src/shared/material-icons/spriteParser.ts`) with a hand-maintained JS twin (`public/app/common/blockIconRuntime.js`). The previously implemented loose per-icon file layout is superseded.

## Consequences

### Positive

- One vendored file instead of ~3,800; smaller repository and static bundle.
- Exports embed only the icons a project actually uses.
- One shared parser; the export output keeps a stable `material-icons/icons/{name}.svg` shape.
- The sprite is regenerable from the pinned `@material-symbols/svg-400` package.

### Negative

- Requires a sprite parser and an in-memory index in two languages (TS + JS twin).
- A single 1.6 MB sprite must be fetched by the editor (once, lazily) versus per-icon requests.

### Neutral

- Missing icon names resolve to the `help` glyph rather than 404ing on a loose file.

## Risks

- **Parser regex robustness**: the sprite is parsed with regexes (`SYMBOL_RE`, `ID_RE`, `VIEWBOX_RE`). A malformed sprite would yield an empty map; mitigated because the sprite is generated deterministically and parse failures degrade to the `help` fallback rather than throwing.
- **TS/JS parser drift**: the two parsers must stay identical; mitigated by mirrored tests and sync comments.
- **Sprite fetch failure in the editor**: mitigated by placeholder hydration once the sprite loads, and by the export `help` data-URI fallback.

## Validation

- Parsing the sprite yields a symbol per icon; unknown names resolve to `help` — `src/shared/material-icons/spriteParser.spec.ts` and `public/app/common/blockIconRuntime.test.js`.
- An export of a project that uses N Material icons resolves exactly those N icons and inlines their `data:` URIs; the file-based exporters (HTML5, SCORM 1.2/2004, single page, ELPX) additionally embed the N reconstructed files under `libs/material-icons/icons/` — `src/shared/export/exporters/BaseExporter.spec.ts` and the per-exporter specs.
- Re-running `node scripts/generate-material-icons.js` reproduces the sprite and catalog.

## Follow-up work

- Consider lazy/streaming parse or a prebuilt index if editor sprite-parse time becomes noticeable on low-end devices.
- See the change design for the full pipeline and remaining follow-up items.

## References

- PR #1497, Issue #1247, the change design.
- ADR-1247-01 (Material Symbols default set), ADR-1247-02 (structured descriptor), ADR-1247-04 (dual rendering + tint).
- `public/libs/material-icons/material-icons.svg`, `scripts/generate-material-icons.js`, `src/shared/material-icons/spriteParser.ts` (+ `.spec.ts`), `src/shared/export/exporters/BaseExporter.ts` (+ `.spec.ts`), `public/app/common/blockIconRuntime.js` (+ `.test.js`), `public/app/yjs/YjsProjectBridge.js`, `public/app/yjs/ResourceFetcher.js`.
