# ELPX Format Documentation

This is the hub for the `.elpx` file format used by eXeLearning v3+. The format is documented across a focused subdoc set under [`doc/elpx-format/`](elpx-format/) — start here, then jump to the specific reference you need.

> **For AI / LLM agents**: read [`elpx-format/ai-generation.md`](elpx-format/ai-generation.md) first, then the [`/llms.txt`](../llms.txt) index at the repo root, then the subdocs cited from each.

> **For the legacy `.elp` format** (eXeLearning 2.x), see [contentv3-format.md](contentv3-format.md).

---

## What is `.elpx`?

An `.elpx` file is a **ZIP archive** containing a complete, self-contained eXeLearning project. It was introduced in eXeLearning v3.0 to replace the legacy Python-pickle `.elp` format. A single `.elpx` carries:

- **`content.xml`** — the project structure in ODE 2.0 XML, validatable against a bundled DTD, re-importable for editing.
- **`index.html` + `html/`** — pre-rendered HTML output, viewable directly in a browser without unpacking.
- **`theme/`, `libs/`, `idevices/`, `content/`** — every CSS, JavaScript, image, font, and asset the rendered content depends on.
- **`screenshot.png`** — 1280×720 PNG project thumbnail at the ZIP root (always present in v4 packages; legacy files without one can be patched with [`scripts/add-screenshot.ts`](../scripts/add-screenshot.ts)).

Because the package contains both the editable source and the rendered output, `.elpx` is the recommended exchange format: human-readable in any browser, re-importable into eXeLearning for editing, and validatable end-to-end.

---

## Quick reference

| Property | Value |
|----------|-------|
| Container | ZIP (deflate) |
| Required root files | `content.xml`, `content.dtd`, `index.html`, `screenshot.png` |
| Required directories | `theme/`, `libs/`, `idevices/<type>/` for each used type |
| Optional root files | `search_index.js` (when search box is enabled) |
| Asset layout | `content/resources/<folderPath>/<filename>` (user folders preserved; legacy v3 UUID subfolders normalised away) |
| Asset reference form | `{{context_path}}/<exportPath>` inside `<htmlView>` / `<jsonProperties>` where `<exportPath>` is `<folderPath>/<filename>` (or just `<filename>` when no folder); `{{context_path}}` resolves to `content/resources/` at render time |
| XML namespace | `http://www.intef.es/xsd/ode` |
| Format version | ODE `2.0` (root `<ode version="2.0">`) |
| Runtime version | constant `ODE_VERSION` = `"3.0"` (XML key `exe_version`) |
| ID format | `[0-9]{14}[A-Z0-9]{6}` |
| iDevice catalog | 43 types (see [catalog](elpx-format/idevices/catalog.md)) |
| Schemas | DTD bundled at root + XSD in repo |

---

## Documentation map

### Container and structure

- **[container.md](elpx-format/container.md)** — every file and directory inside an `.elpx` ZIP, mandatory vs optional, where each entry comes from in the export pipeline.
- **[content-xml.md](elpx-format/content-xml.md)** — full element-by-element reference for `content.xml` (DOCTYPE, root, `<userPreferences>`, `<odeResources>`, `<odeProperties>`, `<odeNavStructures>`, plus the bundled DTD verbatim and pointer to the XSD).
- **[ids.md](elpx-format/ids.md)** — ODE identifier format, generation, lifecycle, cross-hierarchy synchronization rules.
- **[metadata.md](elpx-format/metadata.md)** — every `pp_*` property key, type, default, plus `userPreferences` and `odeResources`.
- **[pages-blocks.md](elpx-format/pages-blocks.md)** — flat-list navigation model, parent-child IDs, ordering, `exe-node:` internal links.

### iDevices

- **[idevices/catalog.md](elpx-format/idevices/catalog.md)** — every iDevice type (modern names, legacy/FPD aliases, downloadable flag, category).
- **[idevices/patterns.md](elpx-format/idevices/patterns.md)** — the four content-storage patterns (Standard JSON, URI-encoded JSON, `<script type="application/json">`, `htmlView`-only) with decision flow.
- **[idevices/config-xml.md](elpx-format/idevices/config-xml.md)** — the per-iDevice `config.xml` schema in `public/files/perm/idevices/base/<type>/`.
- **[idevices/snippets.md](elpx-format/idevices/snippets.md)** — copy-pasteable `<odeComponent>` XML for every type, extracted from real fixtures.

### Resources, themes, assets

- **[themes.md](elpx-format/themes.md)** — theme bundle layout, the 6 in-tree themes (`base`, `flux`, `neo`, `nova`, `universal`, `zen`), per-theme `config.xml`, custom user themes.
- **[libraries.md](elpx-format/libraries.md)** — `libs/` contents and inclusion rules (always-bundled vs conditional, including `common_i18n.js` generation and `elpx-manifest.js`).
- **[assets.md](elpx-format/assets.md)** — the asset URL lifecycle (`asset://` → `{{context_path}}/content/resources/` → relative path).
- **[screenshot.md](elpx-format/screenshot.md)** — root `screenshot.png` spec, dimensions, generation hook, base64 round-trip.

### Pipelines

- **[export-pipeline.md](elpx-format/export-pipeline.md)** — end-to-end export flow with file:line references to `Html5Exporter` / `ElpxExporter` / `OdeXmlGenerator`.
- **[import-pipeline.md](elpx-format/import-pipeline.md)** — three-phase import flow, modern vs legacy fallback, ID remapping.

### Validation and AI generation

- **[validation.md](elpx-format/validation.md)** — DTD vs XSD coverage, mandatory presence checklist, common rejection causes, how to run `xmllint` and `OdeXmlValidator`.
- **[ai-generation.md](elpx-format/ai-generation.md)** — rules and recipes for LLMs producing `.elpx`: the ten non-negotiables, recommended pipeline, pre-flight checklist, prompt-engineering hints.

### Examples

- **[examples/minimal-content-xml.md](elpx-format/examples/minimal-content-xml.md)** — smallest valid `content.xml` (1 page, 1 block, 1 text iDevice) plus a `zip` recipe.
- **[examples/multi-page-content-xml.md](elpx-format/examples/multi-page-content-xml.md)** — hierarchy + multiple iDevices covering all four storage patterns.
- **[examples/full-package-tree.md](elpx-format/examples/full-package-tree.md)** — annotated `unzip -l` of `test/fixtures/really-simple-test-project.elpx`.

---

## ZIP layout at a glance

```
project.elpx (ZIP)
├── content.xml                  # ODE 2.0 project structure (re-importable)
├── content.dtd                  # DTD for XML validation (bundled copy)
├── index.html                   # Entry point (first page rendered as HTML)
├── screenshot.png               # 1280×720 PNG project thumbnail (always present in v4)
├── html/
│   ├── page-title.html          # Additional pages (one file per page)
│   └── ...
├── content/
│   ├── css/
│   │   ├── base.css             # Base stylesheet
│   │   └── icons/*.svg          # ~75 SVG icons used by the eXeLearning runtime UI
│   ├── img/
│   │   └── exe_powered_logo.png
│   └── resources/               # User-uploaded assets (no UUID subfolders in v4)
│       ├── photo.jpg            # asset with no folderPath
│       ├── audio-clip.mp3
│       ├── document.pdf
│       └── photos/              # user-created folder, preserved verbatim
│           └── vacation/sunset.jpg
├── libs/
│   ├── jquery/jquery.min.js
│   ├── bootstrap/bootstrap.bundle.min.js
│   ├── bootstrap/bootstrap.min.css
│   ├── common.js
│   ├── common_i18n.js           # Generated per export language
│   ├── exe_export.js
│   ├── favicon.ico
│   ├── exe_atools/              # Accessibility toolbar (conditional)
│   └── ...                      # Other conditionally-bundled libraries
├── theme/
│   ├── config.xml
│   ├── style.css
│   ├── style.js
│   ├── screenshot.png           # THEME's preview thumbnail (distinct from the project's)
│   ├── icons/
│   └── img/
├── idevices/
│   ├── text/
│   │   ├── text.js
│   │   ├── text.css
│   │   └── text.html
│   └── <type>/                  # One folder per iDevice type used in the project
└── search_index.js              # Optional: present when search box is enabled
```

Detailed mandatory-vs-optional matrix: [container.md](elpx-format/container.md).

---

## Differences from legacy `.elp`

| Aspect | `.elpx` (modern) | `.elp` (legacy) |
|--------|------------------|-----------------|
| Content file | `content.xml` (ODE 2.0) | `contentv3.xml` (Python pickle XML) |
| Root element | `<ode xmlns="...">` | `<instance class="exe.engine.package.Package">` |
| Serialization | Native XML | Python object serialization |
| Hierarchy | Flat list with `odeParentPageId` | Nested `Node` instances |
| Content storage | `<htmlView>` + `<jsonProperties>` (CDATA-wrapped) | `<unicode content="true">` |
| Metadata | `<odeProperty>` elements | Dictionary key-value pairs |
| IDs | `YYYYMMDDHHmmss` + 6 chars | Sequential integers |
| DTD validation | Supported (bundled `content.dtd`) | Not feasible (dynamic structure) |
| Asset paths | `{{context_path}}/content/resources/` | `resources/` |
| HTML output | Included in ZIP | Not included |
| Screenshot | Optional `screenshot.png` at root | None |

For full legacy details, see [contentv3-format.md](contentv3-format.md).

---

## Implementation files (ground-truth code)

| File | Role |
|------|------|
| `src/shared/export/exporters/ElpxExporter.ts` | Builds the ZIP archive (extends `Html5Exporter`) |
| `src/shared/export/exporters/Html5Exporter.ts` | Page generation, theme/library/asset bundling |
| `src/shared/export/exporters/BaseExporter.ts` | Abstract base with `addFilenamesToAssetUrls()` |
| `src/shared/export/generators/OdeXmlGenerator.ts` | Generates `content.xml` from `ExportMetadata` + pages |
| `src/shared/export/metadata-properties.ts` | Single source of truth for `pp_*` property mapping |
| `src/shared/export/constants.ts` | DTD literal, BASE_LIBRARIES, LICENSE_REGISTRY, IDEVICE_TYPE_MAP, LIBRARY_PATTERNS |
| `src/shared/import/ElpxImporter.ts` | Parses `.elpx` and `.elp` files into a Yjs document |
| `src/shared/import/LegacyXmlParser.ts` | Legacy CamelCase type-name remapping for `.elp` files |
| `src/services/xml/xml-parser.ts` | ODE XML parsing helpers |
| `src/services/xml/ode-xml-validator.ts` | DTD/XSD validator |
| `public/app/schemas/ode/content.dtd` | Canonical DTD reference |
| `public/app/schemas/ode/ode-content.xsd` | Stricter XSD with regex-validated IDs and enumerated types |

---

## Test fixtures (real `.elpx` files in this repo)

| Fixture | Use |
|---------|-----|
| `test/fixtures/really-simple-test-project.elpx` | Minimal multi-page project — annotated tree at [examples/full-package-tree.md](elpx-format/examples/full-package-tree.md) |
| `test/fixtures/todos-los-idevices_dos_informes.elpx` | Every iDevice type — primary source for [idevices/snippets.md](elpx-format/idevices/snippets.md) |
| `test/fixtures/Manual de eXeLearning 3.0.elpx` | Full real-world manual covering `text`, `casestudy`, `image-gallery`, `magnifier`, `external-website`, `download-source-file`, `udl-content`, `rubric` |
| `test/fixtures/basic-example-with-custom-theme.elpx` | Custom theme bundling |
| `test/fixtures/arrows.elpx` | Diagram / vector content |

To inspect a fixture: `unzip -l "test/fixtures/<name>.elpx"`. To extract: `unzip -d /tmp/elpx-inspect "test/fixtures/<name>.elpx"`.

---

## See also

- [`/llms.txt`](../llms.txt) — top-level index for LLM consumption (per [llmstxt.org](https://llmstxt.org/))
- [`/llms-full.txt`](../llms-full.txt) — full doc bundle in a single file for LLMs that cannot follow links
- [doc/architecture.md](architecture.md) — system architecture overview
- [doc/conventions.md](conventions.md) — code conventions
- [doc/development/styles.md](development/styles.md) — theme authoring guide
- [doc/development/real-time.md](development/real-time.md) — Yjs and WebSocket model
- [doc/development/rest-api.md](development/rest-api.md) — REST API v1 (external integrations)
- [doc/contentv3-format.md](contentv3-format.md) — legacy `.elp` format
