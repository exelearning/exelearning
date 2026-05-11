# Libraries in ELPX Packages

This document describes the JavaScript and CSS libraries bundled under `libs/` in every `.elpx` export: which files are always present, which are added conditionally based on content, and where each file originates.

> **See also**: [ELPX Format hub](../elpx-format.md) | [Themes](themes.md) | [Assets](assets.md) | [Screenshot](screenshot.md)

---

## 1. `libs/` directory inventory

The following listing is taken from the unzipped sample at `/tmp/elpx-docs-work/fix-simple/libs/`:

```
libs/
├── bootstrap/
│   ├── bootstrap.bundle.min.js
│   ├── bootstrap.bundle.min.js.map
│   ├── bootstrap.min.css
│   └── bootstrap.min.css.map
├── exe_atools/
│   ├── exe_atools.css
│   ├── exe_atools.js
│   ├── exe_atools.png          (sprite sheet)
│   ├── exe_atools_ah.woff2
│   ├── exe_atools_ah_ext.woff2
│   ├── exe_atools_mo.woff2
│   ├── exe_atools_mo_cy.woff2
│   ├── exe_atools_mo_cy_ext.woff2
│   ├── exe_atools_mo_ext.woff2
│   └── exe_atools_mo_vi.woff2
├── jquery/
│   └── jquery.min.js
├── common.js
├── common_i18n.js
├── exe_export.js
└── favicon.ico
```

This sample uses only the `text` iDevice, so no iDevice-specific or conditional libraries appear. When additional iDevices or features are used, more subdirectories are added (see section 3).

---

## 2. Always-bundled base libraries

The constant `BASE_LIBRARIES` in `src/shared/export/constants.ts:325` defines the set of files fetched unconditionally for every export:

```typescript
export const BASE_LIBRARIES = [
    'jquery/jquery.min.js',
    'common.js',
    'exe_export.js',
    'bootstrap/bootstrap.bundle.min.js',
    'bootstrap/bootstrap.bundle.min.js.map',
    'bootstrap/bootstrap.min.css',
    'bootstrap/bootstrap.min.css.map',
];
```

`Html5Exporter` fetches this set at step 7 (`Html5Exporter.ts:267–275`):

```typescript
const baseLibs = await this.resources.fetchBaseLibraries();
for (const [libPath, content] of baseLibs) {
    addFile(`libs/${libPath}`, content);
}
```

Two additional files are always generated or copied outside the `BASE_LIBRARIES` constant:

- **`libs/common_i18n.js`** — generated per-export by `generateI18nContent(meta.language)` (step 7.5, `Html5Exporter.ts:278`). It is a JavaScript file containing localised UI strings (navigation labels, button text) for the content language. It is never a static file; it is produced fresh for each export from the translation tables.
- **`libs/favicon.ico`** — the eXeLearning favicon. Included as part of the base library set fetched from the resource layer.

---

## 3. Conditionally-bundled libraries

Additional libraries are included only when the exported content requires them. Detection is performed by `LibraryDetector.getAllRequiredFilesWithPatternsFromFragments()`, called at step 8 of the HTML5 export (`Html5Exporter.ts:285`):

```typescript
const { files: allRequiredFiles, patterns } = this.getRequiredLibraryFilesForPages(pages, {
    includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
    includeMathJax: meta.addMathJax === true,
    skipMathJax: latexWasRendered && !meta.addMathJax,
});
```

`getRequiredLibraryFilesForPages` is defined in `BaseExporter.ts:943`. It delegates to `LibraryDetector`, which scans every HTML fragment from every iDevice across all pages and matches against `LIBRARY_PATTERNS` (`src/shared/export/constants.ts:107`).

### 3.1 Conditional library matrix

| Library name | Trigger condition | Files added under `libs/` |
|---|---|---|
| `exe_effects` | Content contains a `exe-effects` CSS class | `exe_effects/exe_effects.js` |
| `exe_games` | Content contains a `exe-games` CSS class | `exe_games/exe_games.js`, CSS |
| `exe_highlighter` | Content contains `exe-highlighter` class | `exe_highlighter/exe_highlighter.js`, CSS |
| `exe_lightbox` | Single image with lightbox enabled | `exe_lightbox/exe_lightbox.js`, `exe_lightbox/exe_lightbox.css` |
| `exe_lightbox_gallery` | Image gallery iDevice | `exe_lightbox/exe_lightbox.js`, `exe_lightbox/exe_lightbox.css` |
| `exe_tooltips` | Tooltips iDevice | `exe_tooltips/jquery.qtip.min.js`, `exe_tooltips/jquery.qtip.min.css` |
| `exe_magnify` | Image magnifier iDevice | `exe_magnify/exe_magnify.js`, CSS |
| `exe_media` | Embedded media (audio/video) iDevice | `exe_media/exe_media.js`, CSS |
| `exe_media_link` | Linked media iDevice | `exe_media_link/exe_media_link.js` |
| `abcjs` | ABC music notation iDevice | `abcjs/abcjs-basic.js` |
| `exe_math` | MathJax LaTeX expressions in content **or** `meta.addMathJax === true` | Entire `exe_math/` directory (dynamic extension loading) |
| `exe_math_datagame` | LaTeX found inside encrypted DataGame div | `exe_math/` directory |
| `exe_math_mathml` | MathML content detected | `exe_math/` directory |
| `exe_atools` | `meta.addAccessibilityToolbar === true` | `exe_atools/exe_atools.js`, `exe_atools/exe_atools.css`, fonts, sprite |
| `exe_elpx_download` | `download-source-file` iDevice (CSS class `exe-download-package-link`) | `fflate/fflate.umd.js`, `exe_elpx_download/exe_elpx_download.js` |
| `exe_elpx_download_protocol` | `exe-package:elp` protocol link in any iDevice | `fflate/fflate.umd.js`, `exe_elpx_download/exe_elpx_download.js` |
| `jquery_ui_*` | Various drag-and-drop/ordering game iDevices | `jquery-ui/jquery-ui.min.js` |

**Notes:**

- **Mermaid** (`mermaid.min.js`) is **never** bundled. Mermaid diagrams are always pre-rendered to static SVG before export (`Html5Exporter.ts:182–196`), eliminating the ~2.7 MB runtime library. The comment at `constants.ts:254` confirms: "Mermaid diagrams are always pre-rendered to static SVG … so the ~2.7MB mermaid.min.js library is never needed."
- **MathJax** (`exe_math/`) is skipped when LaTeX has been pre-rendered to SVG+MathML by the browser hook, unless `meta.addMathJax` is explicitly `true` (`Html5Exporter.ts:288`).
- `exe_atools` contains the accessibility toolbar (font switcher, contrast modes, reading ruler). It is only included when the project's "Add Accessibility Toolbar" option is enabled.

### 3.2 `elpx-manifest.js`

When any page uses the `download-source-file` iDevice or contains an `exe-package:elp` link, the exporter generates a manifest file listing every file in the ZIP (`Html5Exporter.ts:344–350`):

```typescript
if (needsElpxDownload && fileList) {
    fileList.push('libs/elpx-manifest.js');
    const manifestJs = this.generateElpxManifestFile(fileList);
    this.zip.addFile('libs/elpx-manifest.js', manifestJs);
}
```

`elpx-manifest.js` is a generated JavaScript file, not a static resource. It contains the complete list of ZIP entry paths so that the browser-side `exe_elpx_download` library can reconstruct the package on the client without a server round-trip.

---

## 4. `common_i18n.js` generation

`common_i18n.js` is the only library file that is always **generated**, never copied. It is produced at step 7.5 by `generateI18nContent(meta.language || 'en')` (`Html5Exporter.ts:278`):

```typescript
const i18nContent = await this.generateI18nContent(meta.language || 'en');
addFile('libs/common_i18n.js', new TextEncoder().encode(i18nContent));
```

The file contains a JSON-like JavaScript object with localised strings for navigation buttons ("Previous", "Next", "Home"), ARIA labels, and other UI text. The content language stored in `meta.language` (an ISO 639-1 code such as `en`, `es`, `fr`) determines which translation strings are embedded.

---

## 5. Per-iDevice files (`idevices/`)

Each iDevice type that appears in the project may contribute its own CSS and JavaScript. These files are placed under `idevices/<type>/`, **not** under `libs/`. The `libs/` directory is reserved for shared cross-project libraries.

Example:

```
idevices/
└── text/
    ├── text.css
    ├── text.html   (template, used during export rendering)
    └── text.js
```

`Html5Exporter` fetches iDevice resources at step 9 (`Html5Exporter.ts:309–321`):

```typescript
const usedIdevices = this.getUsedIdevices(pages);
for (const idevice of usedIdevices) {
    const normalizedType = this.resources.normalizeIdeviceType(idevice);
    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
    for (const [filePath, content] of ideviceFiles) {
        addFile(`idevices/${normalizedType}/${filePath}`, content);
    }
}
```

`getUsedIdevices(pages)` returns the set of distinct iDevice type names found across all pages. Each type name is normalised (e.g. `FreeTextIdevice` → `text`) before forming the ZIP path.

For the iDevice `config.xml` schema and type-name conventions see the iDevice documentation at [doc/elpx-format/idevices/config-xml.md](idevices/config-xml.md).

---

## 6. File-by-file summary

| File | Source location | When included | Purpose |
|------|----------------|---------------|---------|
| `jquery/jquery.min.js` | `public/libs/jquery/` | Always | DOM manipulation framework required by Bootstrap and many iDevices |
| `bootstrap/bootstrap.bundle.min.js` | `public/libs/bootstrap/` | Always | Responsive UI components (modals, dropdowns, accordion) |
| `bootstrap/bootstrap.min.css` | `public/libs/bootstrap/` | Always | Bootstrap base styles |
| `bootstrap/*.map` | `public/libs/bootstrap/` | Always | Source maps for debugging |
| `common.js` | `public/libs/` | Always | eXeLearning shared runtime (navigation, event wiring) |
| `exe_export.js` | `public/libs/` | Always | Export-mode initialisation and SCORM/LMS bridge stubs |
| `favicon.ico` | `public/libs/` | Always | eXeLearning favicon |
| `common_i18n.js` | Generated at export time | Always | Localised UI strings for the content language |
| `exe_atools/exe_atools.js` | `public/libs/exe_atools/` | Accessibility toolbar enabled | Accessibility toolbar (font, contrast, ruler) |
| `exe_atools/exe_atools.css` | `public/libs/exe_atools/` | Accessibility toolbar enabled | Accessibility toolbar styles |
| `exe_atools/*.woff2` / `.woff` | `public/libs/exe_atools/` | Accessibility toolbar enabled | OpenDyslexic and accessible font families |
| `exe_atools/exe_atools.png` | `public/libs/exe_atools/` | Accessibility toolbar enabled | Icon sprite sheet |
| `exe_lightbox/exe_lightbox.js` | `public/libs/exe_lightbox/` | Lightbox or gallery iDevice present | Image lightbox overlay |
| `exe_lightbox/exe_lightbox.css` | `public/libs/exe_lightbox/` | Lightbox or gallery iDevice present | Lightbox styles |
| `exe_math/` (directory) | `public/libs/exe_math/` | MathJax option on, LaTeX detected, or MathML detected | MathJax runtime for LaTeX/MathML rendering |
| `fflate/fflate.umd.js` | `public/libs/fflate/` | download-source-file iDevice present | Client-side ZIP generation library |
| `exe_elpx_download/exe_elpx_download.js` | `public/libs/exe_elpx_download/` | download-source-file iDevice present | Client-side ELPX package assembly |
| `libs/elpx-manifest.js` | Generated at export time | download-source-file iDevice present | Full file manifest for client-side ZIP reconstruction |
| `jquery-ui/jquery-ui.min.js` | `public/libs/jquery-ui/` | Ordering/sorting/drag-drop game iDevices | jQuery UI interactions |
| `exe_tooltips/jquery.qtip.min.js` | `public/libs/exe_tooltips/` | Tooltips iDevice | Tooltip rendering library |
| `exe_media/exe_media.js` | `public/libs/exe_media/` | Embedded media iDevice | HTML5 audio/video player helpers |
| `abcjs/abcjs-basic.js` | `public/libs/abcjs/` | ABC music notation iDevice | ABC music notation renderer |
