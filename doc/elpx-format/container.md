# ELPX Container: ZIP Structure

An `.elpx` file is a standard ZIP archive produced by `ElpxExporter.ts`. It bundles a complete HTML5 rendition of the project together with a re-importable `content.xml`. This document describes every entry in the archive, where each one comes from, and which entries are required by the importer.

See also: [ELPX format overview](../elpx-format.md) | [IDs](ids.md) | [Pages and blocks](pages-blocks.md) | [Metadata](metadata.md)

---

## Folder tree (fix-simple fixture)

The tree below is extracted from the unzipped fixture at `/tmp/elpx-docs-work/fix-simple/`. Individual icon SVG files in `content/css/icons/` are collapsed for brevity.

```
project.elpx (ZIP)
├── content.xml                      # ODE 2.0 project structure (re-importable)
├── content.dtd                      # DTD for content.xml validation (always bundled in v4)
├── index.html                       # First page rendered as HTML
├── screenshot.png                   # 1280×720 PNG project thumbnail (always present in v4)
├── search_index.js                  # (optional) Search index — only when pp_addSearchBox=true
├── content/
│   ├── css/
│   │   ├── base.css                 # Base stylesheet
│   │   └── icons/                   # … 75 icon SVGs (exe-*.svg, plus.svg, etc.)
│   ├── img/
│   │   └── exe_powered_logo.png
│   └── resources/                   # Project assets — no UUID subfolders in v4
│       ├── photo.jpg                # asset with no folderPath
│       ├── audio-clip.mp3
│       ├── document.pdf
│       └── photos/                  # user-created folder, preserved verbatim
│           └── vacation/sunset.jpg  # nested user folder is fine
├── html/
│   ├── page-1-1.html
│   ├── page-1-1-1.html
│   ├── page-1-2.html
│   ├── page-2.html
│   └── page-2-1.html
├── idevices/
│   └── text/
│       ├── text.css
│       ├── text.html
│       └── text.js
├── libs/
│   ├── bootstrap/
│   │   ├── bootstrap.bundle.min.js
│   │   ├── bootstrap.bundle.min.js.map
│   │   ├── bootstrap.min.css
│   │   └── bootstrap.min.css.map
│   ├── common.js
│   ├── common_i18n.js
│   ├── exe_atools/                  # Accessibility toolbar assets
│   ├── exe_export.js
│   ├── favicon.ico
│   └── jquery/
│       └── jquery.min.js
├── theme/
│   ├── config.xml
│   ├── icons/                       # Theme-specific block icons (PNG)
│   ├── img/
│   │   ├── icons.png
│   │   └── licenses.gif
│   ├── screenshot.png               # Theme preview (not the project screenshot)
│   ├── style.css
│   └── style.js
└── custom/                          # (optional) Custom CSS/JS injected by pp_customStyles
```

---

## Mandatory vs. optional entry matrix

| Entry | Required in ZIP | Required by importer | Notes |
|---|---|---|---|
| `content.xml` | Yes | Yes — mandatory | Missing = import error |
| `content.dtd` | Yes — always bundled in v4 | No | For offline XML validation; emitted by `ElpxExporter` from `ODE_DTD_CONTENT` (`constants.ts:1006`) |
| `index.html` | Yes | No | Pre-rendered first page; ignored on import |
| `screenshot.png` (archive root) | Yes in v4 | No | 1280×720 PNG project thumbnail. Required for v4 packages so external systems (LMS, file managers, repositories) can show a preview. Stored in Yjs `metadata.screenshot` on import. See [screenshot.md](screenshot.md). |
| `html/*.html` | Yes (one per extra page) | No | Pre-rendered pages; ignored on import |
| `content/css/base.css` | Yes | No | Rendering only |
| `content/css/icons/` | Yes | No | Rendering only |
| `content/img/exe_powered_logo.png` | Conditional | No | Added only when `pp_addExeLink` is `true` |
| `content/resources/<filename>` | When project has assets | No | Flat layout. Asset data; importer reads these for `asset://` mapping. See [assets.md](assets.md). |
| `libs/` | Yes | No | jQuery, Bootstrap, i18n scripts |
| `theme/` | Yes | No | Theme CSS/JS; re-applied on export after import |
| `idevices/<type>/` | One per iDevice type used | No | iDevice-specific CSS/JS |
| `custom/` | Optional | No | Written only when `pp_customStyles` is non-empty |
| `search_index.js` | Optional | No | Written only when `pp_addSearchBox` is `true` |

Notes:

- `content/resources/` entries are read by the importer during the asset extraction phase (`importAssets()`), so they are effectively required when the project references any assets. Without them, asset references in `content.xml` will resolve to missing files.
- `content/resources/` mirrors the project's asset folder tree in v4: assets without a `folderPath` live at the root of `content/resources/`, and any user-created folders (e.g. `photos/`, `lesson-1/handouts/`) appear as real subdirectories under the same path. The legacy v3 per-asset UUID subfolder pattern (`content/resources/<14-digit-timestamp><6-char-suffix>/<filename>`) is **not** part of v4 and is normalised by [`scripts/flatten-elpx.ts`](../../scripts/flatten-elpx.ts) (which only collapses folders matching that exact regex; user folders are preserved untouched).
- `screenshot.png` and `content.dtd` are produced for every export by `ElpxExporter`. If you receive a v3-era `.elpx` without one or both, run `scripts/add-screenshot.ts` and re-export through `elp:convert` to bring it up to the v4 baseline.

---

## Where each entry comes from

All ZIP assembly happens in `ElpxExporter.ts`. `ElpxExporter` extends `Html5Exporter`; the HTML rendering pass runs first, then ELPX-specific files are added in a second section.

| Entry | Producer method / location |
|---|---|
| `index.html` | `Html5Exporter` — page render loop, first page is always `index.html` |
| `html/<slug>.html` | `Html5Exporter` — one call per additional page, slug derived from page title |
| `content/css/base.css` | `Html5Exporter` — `addFile('content/css/base.css', baseCss)` |
| `content/css/icons/` | `Html5Exporter` — iterates icon directory from theme assets |
| `content/img/exe_powered_logo.png` | `Html5Exporter` — conditional on `pp_addExeLink` |
| `content/resources/` | `Html5Exporter` — iterates project assets from Yjs `assets` Y.Map |
| `libs/` | `Html5Exporter` — iterates `BASE_LIBRARIES` and detected `LIBRARY_PATTERNS` |
| `theme/` | `Html5Exporter` — iterates active theme files |
| `idevices/<type>/` | `Html5Exporter` — one subdirectory per iDevice type present in the project |
| `search_index.js` | `Html5Exporter` — conditional on `pp_addSearchBox` (`addFile('search_index.js', ...)`) |
| `content.xml` | `ElpxExporter` — `generateOdeXml()` via `OdeXmlGenerator.ts`, then `this.zip.addFile('content.xml', contentXml)` |
| `content.dtd` | `ElpxExporter` — `this.zip.addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT)` where `ODE_DTD_FILENAME = 'content.dtd'` (`constants.ts:995`) |
| `screenshot.png` (root) | `ElpxExporter` — `this.zip.addFile('screenshot.png', screenshotBuffer)`. v4 always emits one: either the user-set screenshot or a generated thumbnail. |
| `custom/` | `Html5Exporter` — written when `pp_customStyles` is non-empty |

The final ZIP is assembled using JSZip (browser) or a compatible in-process archiver (server). The `ElpxExporter` accumulates all entries via `this.zip.addFile(path, content)` calls and serializes the archive in one step at the end of `export()`.

---

## Re-importable requirement

The importer (`ElpxImporter.ts`) only **strictly** requires:

1. `content.xml` — mandatory. Its absence throws `'content.xml is missing'`.
2. `content/resources/<filename>` — required per asset referenced in `content.xml`. Assets are mapped from `{{context_path}}/<filename>` (or the legacy `{{context_path}}/content/resources/<filename>` form) back to internal `asset://` URIs during the asset extraction phase.
3. `screenshot.png` at the archive root — read when present and stored as a base64 data URL under the `screenshot` metadata key.

In other words a `.elpx` will round-trip into the editor as long as it has `content.xml` plus any referenced assets. HTML files, libraries, theme files, and iDevice assets are not read by the importer and can be absent without error.

That said, for **publication and exchange** the v4 baseline is stricter: every released `.elpx` should carry `content.dtd`, `screenshot.png`, `index.html`, the `theme/`, `libs/`, and `idevices/<type>/` directories so the package is offline-viewable in any browser without a re-import. The exporter always produces this complete set; only round-tripped imports of older v3 fixtures may need to be patched up via [`scripts/add-screenshot.ts`](../../scripts/add-screenshot.ts).

For EPUB3 archives, the importer also handles `EPUB/content.xml` by stripping the `EPUB/` prefix before processing, making the path equivalent to a root-level `content.xml`.

---

## Minimum content for a v4 `.elpx`

The smallest **v4-compliant** package — one that passes validation, opens cleanly in any browser, and re-imports without warnings — must contain at minimum:

```
project.elpx
├── content.xml                  # ODE 2.0 XML, references 'content.dtd' in DOCTYPE
├── content.dtd                  # bundled DTD (constant ODE_DTD_CONTENT)
├── index.html                   # rendered first page
├── screenshot.png               # 1280×720 project thumbnail (PNG)
├── theme/                       # at minimum config.xml + style.css + style.js
├── libs/                        # base libraries (jQuery, Bootstrap, common.js, exe_export.js, common_i18n.js)
└── idevices/<type>/             # CSS/JS for every iDevice type used
```

If `content.xml` references assets, add them under `content/resources/<filename>` (flat). If pages other than `index.html` exist, add `html/<slug>.html` per page.

A package that lacks `screenshot.png` or `content.dtd` will still re-import (the importer is lenient), but it is considered out-of-spec for v4. See [validation.md](validation.md) for the full checklist and [ai-generation.md](ai-generation.md) for an LLM-friendly version.

---

## Compression

`.elpx` is a standard ZIP archive. Compression is handled by JSZip in the browser exporter. The `ElpxExporter` does not set a specific compression level per file; JSZip defaults apply. Binary assets (images, fonts) are stored without re-compression. Text files (`content.xml`, HTML, CSS, JS) benefit from DEFLATE compression.

The archive is finalized with `this.zip.generateAsync({ type: 'uint8array' })` (browser) or the equivalent server-side call in `ElpxExporter.export()`.
