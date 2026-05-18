# ELPX Export Pipeline

Reference document for the end-to-end process that turns a Yjs document into a
downloadable `.elpx` file.

Related documents: [import-pipeline.md](./import-pipeline.md) |
[validation.md](./validation.md)

---

## 1. Trigger — Two Entry Points

### 1.1 Browser-first (primary path)

The UI invokes `SharedExporters` client-side. The exporter reads the live Yjs
Y.Doc directly, builds the ZIP entirely in memory with `fflate`/JSZip, and
either triggers a browser download or hands the buffer to Electron for a
save-dialog.

`AGENTS.md §7.9` describes this as the primary path: "UI triggers export →
`SharedExporters` generates ZIP in memory → browser downloads (web) or Electron
saves to disk."

The entry point class is `ElpxExporter`, which extends `Html5Exporter`, which
extends `BaseExporter`
(`src/shared/export/exporters/ElpxExporter.ts`,
`src/shared/export/exporters/Html5Exporter.ts`,
`src/shared/export/exporters/BaseExporter.ts`).

### 1.2 Server-side (fallback / CLI / external API)

The server receives `POST /api/export/:sessionId/:exportType/download`. It reads
the project from the database and the Yjs snapshot, reconstructs the document,
instantiates `ElpxExporter`, runs the same pipeline, writes the ZIP to
`FILES_DIR/dist/...`, and streams it back.

CLI equivalents (`Makefile:359-428`):

```
make export-elpx FORMAT=elpx INPUT=/path/to/file.elpx OUTPUT=/path/to/out.elpx
make export-html5 INPUT=...
make export-scorm12 INPUT=...
```

---

## 2. HTML5 Build — `Html5Exporter.export()`

`Html5Exporter.export()` (`Html5Exporter.ts:68`) executes twelve numbered
phases. `ElpxExporter` reuses all of them (calling the same inherited methods)
and adds two extra phases for ELPX-specific files. The phases below reference
the `ElpxExporter.export()` numbering (`ElpxExporter.ts:98`).

### Phase 0 — Theme prefetch

`prepareThemeData(themeName)` (`Html5Exporter.ts:476`) fetches all files for the
active theme. It extracts the list of root-level `.css`/`.js` filenames into
`themeRootFiles` for use in HTML `<head>` includes. It also detects a
`favicon.ico` or `favicon.png` inside the theme. If the fetch fails, fallback
stubs are used (see `getFallbackThemeCss()` / `getFallbackThemeJs()`).

Theme selection priority: export option → `metadata.theme` → `'base'`
(`ElpxExporter.ts:110`).

### Phase 1 — Page HTML generation (`pageHtmlMap`)

`generatePageHtml()` (`Html5Exporter.ts:381`) is called once per page. Before
rendering, `preprocessPagesForExport()` (`BaseExporter.ts:705`) deep-clones all
pages, calls `addFilenamesToAssetUrls()` to rewrite `asset://uuid` references to
`{{context_path}}/content/resources/<exportPath>`, and calls
`replaceInternalLinks()` to rewrite `exe-node:<pageId>` hrefs to relative HTML
paths.

`buildPageFilenameMap()` (`BaseExporter.ts:758`) assigns collision-safe filenames
to all pages. The first page is always `index.html`; subsequent pages are
`html/<sanitized-title>.html`. Collisions are resolved by incrementing trailing
numbers.

Mermaid diagrams are optionally pre-rendered to static SVG via the
`options.preRenderMermaid` hook (`ElpxExporter.ts:175`). When diagrams are
pre-rendered the Mermaid library is not included in the export (saving ~2.7 MB).

Note: LaTeX pre-rendering is disabled in the ELPX exporter (no
`preRenderLatex` hook call) — MathJax runtime handling is used instead.

Pages are buffered in `pageHtmlMap` (a `Map<string, string>`) and written to the
ZIP only after the ELPX manifest is resolved (phase 1.10 / 1.11), so that
manifest `<script>` tags can be injected into the correct pages.

### Phase 1.2 — Search index

When `meta.addSearchBox` is `true`, `pageRenderer.generateSearchIndexFile()` is
called and written to `search_index.js` (`ElpxExporter.ts:199`).

### Phase 1.3 — Base CSS

`resources.fetchContentCss()` returns `content/css/base.css`. If Mermaid was
pre-rendered, the CSS for static SVG rendering is appended inline
(`ElpxExporter.ts:206-220`). The file is written to `content/css/base.css`.

### Phase 1.4 — eXeLearning logo

`resources.fetchExeLogo()` is fetched and written to
`content/img/exe_powered_logo.png` for the "Made with eXeLearning" footer
(`ElpxExporter.ts:225-233`).

### Phase 1.5 — Theme files

All files from the pre-fetched `themeFilesMap` are written under `theme/`
(`ElpxExporter.ts:235-243`). If prefetch failed, the two fallback stubs are
written as `theme/style.css` and `theme/style.js`.

### Phase 1.6 — Base libraries

`resources.fetchBaseLibraries()` returns jQuery, Bootstrap, `common.js`,
`exe_export.js`, and related files. These are always included
(`ElpxExporter.ts:247-259`). See `constants.ts:325-337` for the full list.

A localised `libs/common_i18n.js` is generated from the project's content
language via `generateI18nContent()` (`ElpxExporter.ts:261-262`).

### Phase 1.7 — Content-driven libraries

`getRequiredLibraryFilesForPages()` (`BaseExporter.ts:943`) iterates all
component HTML fragments to detect which optional libraries are needed (effects,
games, media player, tooltips, MathJax, ELPX download support, etc.). The full
pattern list is in `constants.ts:107-315`.

Detected files are fetched and added under `libs/`. Files already present from
phase 1.6 are skipped (`ElpxExporter.ts:278`).

### Phase 1.8 — Per-iDevice assets

`getUsedIdevices()` collects all distinct iDevice type names. For each type,
`resources.fetchIdeviceResources()` is called and files are written under
`idevices/<normalizedType>/` (`ElpxExporter.ts:289-309`). Missing iDevice
resource directories are silently skipped (normal for most iDevice types).

### Phase 1.9 — Project assets

`addAssetsToZipWithResourcePath()` (`BaseExporter.ts:429`) iterates every asset
in the project, resolves its export path from `buildAssetExportPathMap()`, and
writes it to `content/resources/<exportPath>`. The export path map uses the
asset's `folderPath` metadata to recreate the original folder structure, with
collision detection (`BaseExporter.ts:560-623`).

### Phase 1.10 / 1.11 — ELPX download manifest and HTML pages

If any page contains a `download-source-file` iDevice or an `exe-package:elp`
link (`needsElpxDownloadSupport()`, `BaseExporter.ts:961`), a manifest file is
generated:

1. `generateElpxManifestFile(fileList)` (`BaseExporter.ts:1060`) produces
   `libs/elpx-manifest.js` containing `window.__ELPX_MANIFEST__` with the
   complete file list and project title.
2. Pages that contain the iDevice get a `<script src="libs/elpx-manifest.js">`
   tag injected before `</body>` (`ElpxExporter.ts:334-338`).

HTML pages are then written to the ZIP: first page as `index.html`, remaining
pages as `html/<uniqueFilename>` (`ElpxExporter.ts:327-339`).

---

## 3. ELPX-specific Add-ons — Section 2 of `ElpxExporter.export()`

These three steps are unique to ELPX and do not appear in the base HTML5 export.

### Phase 2.1 — `content.xml`

`generateOdeXml(meta, pages)` (`OdeXmlGenerator.ts:43`) is called with the
preprocessed pages. The generated XML is immediately validated:

```
validateXml(contentXml)  // src/services/xml/xml-parser.ts:134
formatValidationErrors(validation)
```

If validation fails, the export is aborted with an error
(`ElpxExporter.ts:350-355`). The validated XML is written to `content.xml`
(`ElpxExporter.ts:360`).

`generateOdeXml` emits the following XML skeleton
(`OdeXmlGenerator.ts:43-72`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
  <userPreferences>  <!-- theme key -->
  <odeResources>     <!-- odeId, odeVersionId, exe_version -->
  <odeProperties>    <!-- all ExportMetadata fields -->
  <odeNavStructures> <!-- one <odeNavStructure> per page -->
```

Each page node (`generateOdeNavStructureXml`, `OdeXmlGenerator.ts:154`) contains
`<odePageId>`, `<odeParentPageId>`, `<pageName>`, `<odeNavStructureOrder>`,
`<odeNavStructureProperties>`, and `<odePagStructures>`.

Each block (`generateOdePagStructureXml`, `OdeXmlGenerator.ts:200`) contains
`<odeBlockId>`, `<blockName>`, `<iconName>`, `<odePagStructureOrder>`, and
`<odeComponents>`.

Each component (`generateOdeComponentXml`, `OdeXmlGenerator.ts:258`) contains:
- `<odeIdeviceTypeName>` — the iDevice type string
- `<htmlView>` — pre-rendered HTML wrapped in CDATA
- `<jsonProperties>` — serialised JSON wrapped in CDATA
- `<odeComponentsOrder>`

CDATA content that contains the sequence `]]>` is split using the escape
`]]]]><![CDATA[>` (`OdeXmlGenerator.ts:352`).

The ODE identifier format is `YYYYMMDDHHmmss` + 6 uppercase alphanumeric chars
(`generateOdeId()`, `OdeXmlGenerator.ts:315`).

### Phase 2.2 — `content.dtd`

The constant `ODE_DTD_CONTENT` (`constants.ts:1006`) is written verbatim as
`content.dtd` (`ElpxExporter.ts:363`). The DTD filename is `ODE_DTD_FILENAME =
'content.dtd'` (`constants.ts:995`).

### Phase 2.3 — `screenshot.png`

Screenshot selection follows a priority chain (`ElpxExporter.ts:365-387`):

1. `meta.screenshot` — base64 data URL stored in project metadata (custom
   screenshot set by the user).
2. `options.generateScreenshot(firstPageHtml)` — browser hook that renders the
   `index.html` page to a PNG data URL.
3. If neither produces a valid PNG, no screenshot is included.

`decodeScreenshotToBuffer()` (`ElpxExporter.ts:41`) decodes the base64 payload
and validates the PNG magic bytes `89 50 4E 47 0D 0A 1A 0A`. Invalid data is
silently discarded.

---

## 4. ZIP Packaging — Section 3 of `ElpxExporter.export()`

`this.zip.generateAsync()` (`ElpxExporter.ts:395`) compresses all accumulated
files with deflate and returns a `Buffer`. The returned `ExportResult` contains
the buffer and the export filename built by `buildFilename()`
(`BaseExporter.ts:392`):

```
<sanitized-title><suffix><extension>
// Example: my-project.elpx  (suffix = '', extension = '.elpx')
```

Debug timing information is optionally logged to
`window.__currentElpxExportTrace` when
`window.eXeLearning.config.debugElpxExport = true`
(`BaseExporter.ts:64-115`).

---

## 5. Distribution

| Path | Description |
|------|-------------|
| Browser download | `ExportResult.data` buffer is converted to a blob URL |
| Electron save | Main process writes the buffer to the user-chosen path |
| Server response | Buffer streamed back as `Content-Type: application/zip` |
| CLI | `make export-elpx` / `make export-html5` write to `OUTPUT` path |

---

## End-to-End Flow Diagram

```
UI click / CLI call
        |
        v
  ElpxExporter.export()
        |
        +--[Phase 0]----> prepareThemeData()
        |                  themeFilesMap, themeRootFiles, faviconInfo
        |
        +--[Phase 1]----> preprocessPagesForExport()
        |                  addFilenamesToAssetUrls()
        |                  replaceInternalLinks()
        |                  buildPageFilenameMap()
        |                  generatePageHtml() x N  --> pageHtmlMap
        |                  optional Mermaid pre-render
        |
        +--[1.2]---------> search_index.js (optional)
        +--[1.3]---------> content/css/base.css
        +--[1.4]---------> content/img/exe_powered_logo.png
        +--[1.5]---------> theme/* (all theme files)
        +--[1.6]---------> libs/jquery, bootstrap, common.js ...
        |                  libs/common_i18n.js
        +--[1.7]---------> libs/<detected optional libs>
        +--[1.8]---------> idevices/<type>/*
        +--[1.9]---------> content/resources/<assetPath>
        +--[1.10]--------> libs/elpx-manifest.js (if download-source-file)
        +--[1.11]--------> index.html, html/*.html
        |
        +--[2.1]---------> generateOdeXml() --> validateXml() --> content.xml
        +--[2.2]---------> content.dtd
        +--[2.3]---------> screenshot.png (if available)
        |
        +--[3]-----------> zip.generateAsync()
                            |
                            v
                      Buffer + filename
                            |
               +------------+------------+
               |            |            |
          Browser        Electron      Server
          download     save dialog    stream/dist
```
