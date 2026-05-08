# Full package tree

This page annotates the complete `unzip -l` listing of the fixture file
`test/fixtures/really-simple-test-project.elpx`. That file is a real export produced by
the eXeLearning v4 codebase in this repository, so every entry name, size, and timestamp
is authoritative.

Use this listing as a quick orientation map. Each section below points to the subdoc that
covers the relevant files in depth.

Full container reference: [../container.md](../container.md).
Minimal content.xml walkthrough: [minimal-content-xml.md](minimal-content-xml.md).
Multi-page content.xml walkthrough: [multi-page-content-xml.md](multi-page-content-xml.md).

---

## Raw listing

```
Archive:  really-simple-test-project.elpx
  Length      Date    Time    Name
---------  ---------- -----   ----
    10696  04-27-2026 21:11   search_index.js

    13032  04-27-2026 21:11   content/css/base.css
     1996  04-27-2026 21:11   content/img/exe_powered_logo.png

    21476  04-27-2026 21:11   theme/screenshot.png
     4307  04-27-2026 21:11   theme/style.js
      490  04-27-2026 21:11   theme/config.xml
    12855  04-27-2026 21:11   theme/style.css
     1978  04-27-2026 21:11   theme/img/licenses.gif
     4813  04-27-2026 21:11   theme/img/icons.png

     -- 50 PNG icons under theme/icons/ (activity.png, ask.png, book.png, …) --
     1902  04-27-2026 21:11   theme/icons/info.png
     2133  04-27-2026 21:11   theme/icons/roadmap.png
      …
     2745  04-27-2026 21:11   theme/icons/english.png
     -- end of theme/icons/ --

    87533  04-27-2026 21:11   libs/jquery/jquery.min.js
    80743  04-27-2026 21:11   libs/bootstrap/bootstrap.bundle.min.js
   232018  04-27-2026 21:11   libs/bootstrap/bootstrap.min.css
   332347  04-27-2026 21:11   libs/bootstrap/bootstrap.bundle.min.js.map
   589698  04-27-2026 21:11   libs/bootstrap/bootstrap.min.css.map
    33609  04-27-2026 21:11   libs/exe_export.js
   115416  04-27-2026 21:11   libs/common.js
     2889  04-27-2026 21:11   libs/favicon.ico
     3107  04-27-2026 21:11   libs/common_i18n.js

     -- exe_atools (accessibility toolbar) — 14 files --
    23647  04-27-2026 21:11   libs/exe_atools/exe_atools.js
     6200  04-27-2026 21:11   libs/exe_atools/exe_atools.css
     2297  04-27-2026 21:11   libs/exe_atools/exe_atools.png
   144200  04-27-2026 21:11   libs/exe_atools/exe_atools_od_b.woff
   132640  04-27-2026 21:11   libs/exe_atools/exe_atools_od_bi.woff
   132408  04-27-2026 21:11   libs/exe_atools/exe_atools_od.woff
   130192  04-27-2026 21:11   libs/exe_atools/exe_atools_od_i.woff
    17184  04-27-2026 21:11   libs/exe_atools/exe_atools_ah.woff2
     9328  04-27-2026 21:11   libs/exe_atools/exe_atools_ah_ext.woff2
    14940  04-27-2026 21:11   libs/exe_atools/exe_atools_mo.woff2
    13508  04-27-2026 21:11   libs/exe_atools/exe_atools_mo_ext.woff2
     8636  04-27-2026 21:11   libs/exe_atools/exe_atools_mo_cy.woff2
     9584  04-27-2026 21:11   libs/exe_atools/exe_atools_mo_cy_ext.woff2
     5080  04-27-2026 21:11   libs/exe_atools/exe_atools_mo_vi.woff2
     -- end of exe_atools --

       52  04-27-2026 21:11   idevices/text/text.html
     1314  04-27-2026 21:11   idevices/text/exequextsq.svg
      342  04-27-2026 21:11   idevices/text/text.css
     8211  04-27-2026 21:11   idevices/text/text.js

     4955  04-27-2026 21:11   index.html
     5069  04-27-2026 21:11   html/page-1---1.html
     5110  04-27-2026 21:11   html/page-1---1--1.html
     5075  04-27-2026 21:11   html/page-1---2.html
     5040  04-27-2026 21:11   html/page-2.html
     5053  04-27-2026 21:11   html/page-2---1.html

    31098  04-27-2026 21:11   content.xml
     2251  04-27-2026 21:11   content.dtd
    67239  04-27-2026 21:11   screenshot.png
---------                     -------
  2444866                     95 files
```

The 50-icon and 14-font groups are collapsed for readability; the actual archive lists
each file individually. Run `unzip -l test/fixtures/really-simple-test-project.elpx`
in the repository root to see the full enumeration.

---

## Section walkthrough

### Root files

| File | Size | Description |
|------|------|-------------|
| `content.xml` | 31 KB | The ODE 2.0 project structure. The **only** file the importer requires — every other file is part of the rendered HTML payload. See [minimal-content-xml.md](minimal-content-xml.md) and the full reference in [../content-xml.md](../content-xml.md). |
| `content.dtd` | 2.2 KB | Bundled DTD for offline validation of `content.xml`. Generated from `ODE_DTD_CONTENT` in `src/shared/export/constants.ts:1006`. Always emitted by `ElpxExporter` in v4 packages. |
| `index.html` | 4.9 KB | First page rendered as a self-contained HTML5 document. It includes navigation, theme, and iDevice scripts via relative paths. This is what browsers open when the ZIP is extracted. |
| `screenshot.png` | 67 KB | 1280×720 PNG project thumbnail at the archive root. v4 packages always carry one; legacy packages without it are patched by [`scripts/add-screenshot.ts`](../../../scripts/add-screenshot.ts). See [../screenshot.md](../screenshot.md). |
| `search_index.js` | 11 KB | Pre-built search index for the runtime search box. Emitted only when `pp_addSearchBox` is `true` in `<odeProperties>`. |

This fixture has the search box enabled, hence the presence of `search_index.js`.
Distinct from `theme/screenshot.png`, which is the **theme** preview thumbnail used in the
theme picker — see the [`theme/`](#theme--active-theme-files) section.

---

### `html/` — per-page HTML files

```
html/page-1---1.html      5.1 KB   Page "Page 1 - 1"      (child of Page 1)
html/page-1---1--1.html   5.1 KB   Page "Page 1 - 1 - 1"  (child of Page 1-1)
html/page-1---2.html      5.1 KB   Page "Page 1 - 2"      (child of Page 1)
html/page-2.html          5.0 KB   Page "Page 2"           (root page)
html/page-2---1.html      5.1 KB   Page "Page 2 - 1"      (child of Page 2)
```

One `.html` file per page, except the first root page which becomes `index.html`.
Filenames are slugified from page titles; spaces become `-` and the slugifier escapes
literal hyphens by doubling them — that is why `Page 1 - 1` becomes `page-1---1.html`
(three dashes: the original `-` plus the two delimiter dashes around the spaces).
Internal links use relative paths (`../html/page-2.html`); `exe-node:<pageId>` URIs in
`content.xml` are resolved to these relative paths at export time.

The exporter that writes these files is `src/shared/export/exporters/Html5Exporter.ts`.
See [../container.md](../container.md) for the complete naming algorithm.

---

### `content/css/` — base stylesheet

```
content/css/base.css    13 KB   Core layout + utility classes for all themes
```

`base.css` defines the structural layout (`.exe-layout`, `.exe-block`, block visibility
toggles, accessibility toolbar) that is theme-independent. Themes layer their own
`theme/style.css` on top.

> **Note**: previous v3-era exports also wrote `content/css/icons/*.svg` (around 75 small
> SVG files for the runtime UI). The v4 exporter no longer ships them at this path —
> icon glyphs are inlined into `base.css` and `theme/style.css` as data URIs or referenced
> from the active theme's own `icons/` directory.

See [../themes.md](../themes.md) for the CSS layering model.

---

### `content/img/` — branding image

```
content/img/exe_powered_logo.png    2 KB    "Powered by eXeLearning" badge
```

Displayed in the footer when `pp_addExeLink` is `true` in `<odeProperties>`. The exporter
injects a `<footer>` element referencing this image into every page HTML file.

---

### `content/resources/` — project assets (absent in this fixture)

`content/resources/` is the directory that holds **project assets** — every image, audio
file, video, PDF, or other binary the user uploads through the file manager. The v4
layout is:

```
content/resources/<filename>                  # asset with no folderPath
content/resources/<folderPath>/<filename>     # asset inside a user-created folder
```

See [../assets.md](../assets.md) for the asset URL lifecycle and
[../container.md](../container.md) for the naming/dedup rules.

This particular fixture (`really-simple-test-project.elpx`) is **text-only** — it contains
six `text` iDevices but no uploaded media. Therefore `content/resources/` is **not present
at all** in the archive: empty directories are not emitted, and there are no asset files
to write. A non-empty fixture, e.g.
`test/fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx`, shows the
real layout. Inspect it with:

```bash
unzip -l test/fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx \
    | awk '/content\/resources\//'
```

> **What you will not see** in any v4 archive is the legacy v3 per-asset UUID subfolder
> pattern `content/resources/[0-9]{14}[A-Z0-9]{6}/<filename>` — it has been normalised
> away by [`scripts/flatten-elpx.ts`](../../../scripts/flatten-elpx.ts), which only
> collapses folders matching that exact regex (user folders are preserved). See
> [../validation.md](../validation.md).

---

### `theme/` — active theme files

```
theme/config.xml        490 B    Theme metadata (name, version, author)
theme/style.css          13 KB   Theme-specific CSS layered over base.css
theme/style.js          4.3 KB   Theme JavaScript (animations, special behaviours)
theme/screenshot.png     21 KB   Theme thumbnail shown in the theme picker
theme/img/icons.png     4.8 KB   Sprite sheet for decorative inline icons
theme/img/licenses.gif  2.0 KB   Creative Commons license badge variants
theme/icons/*.png        50 files  Pedagogical activity icons used in block headers
```

The theme directory is a copy of the active theme from
`public/files/perm/themes/base/<themeName>/`. For this fixture the active theme is `base`
(the default). `style.css` and `style.js` are loaded after Bootstrap and `base.css` in
every page `<head>`.

> Distinct from the **project-level** `screenshot.png` at the archive root: that is a
> thumbnail of the project's first page; this one is the theme's own preview image.

See [../themes.md](../themes.md) for the theme authoring guide and the full `config.xml`
schema.

---

### `theme/icons/` — pedagogical activity icons

50 PNG files named after pedagogical activity types (`activity.png`, `ask.png`, `book.png`,
`calculate.png`, …). Displayed in block headers when an educator assigns an activity type
to a block. Theme icon sets are part of the theme and can be replaced by a custom theme.

---

### `libs/` — runtime libraries

```
libs/jquery/jquery.min.js                88 KB   jQuery 3.x minified
libs/bootstrap/bootstrap.bundle.min.js   81 KB   Bootstrap 5 JS + Popper (minified)
libs/bootstrap/bootstrap.min.css        232 KB   Bootstrap CSS (minified)
libs/bootstrap/bootstrap.bundle.min.js.map  332 KB   JS source map (DevTools)
libs/bootstrap/bootstrap.min.css.map    590 KB   CSS source map (DevTools)
libs/common.js                          115 KB   Shared runtime utilities
libs/exe_export.js                       34 KB   Export-time helpers
libs/common_i18n.js                     3.1 KB   Localised strings (generated per export)
libs/favicon.ico                        2.9 KB   Browser tab icon
libs/exe_atools/                       14 files   Accessibility toolbar (JS, CSS, sprite, fonts)
```

`common.js` initialises page navigation, block collapse/expand, the search index, and
inter-page messaging. `common_i18n.js` is generated from the active locale at export time
(`Html5Exporter.generateI18nBundle()`), so its contents reflect the chosen `pp_lang`.
`exe_export.js` handles download, print, and share actions. The `exe_atools` directory
ships the runtime accessibility toolbar (font-size, contrast, dyslexia-friendly fonts —
WOFF/WOFF2 OpenDyslexic and high-contrast typefaces). Loaded only when
`pp_addAccessibilityToolbar` is `true`.

The base library set is the constant `BASE_LIBRARIES` in `src/shared/export/constants.ts:325`.
Conditional libraries (lightbox, MathJax, qTip, etc.) are added on demand via
`LIBRARY_PATTERNS` in the same file.

See [../libraries.md](../libraries.md) for the full library inventory.

---

### `idevices/text/` — text iDevice runtime files

```
idevices/text/text.html      52 B   Editor template stub (empty in export)
idevices/text/text.css      342 B   Styles for the text iDevice container
idevices/text/text.js       8.2 KB   Runtime behaviour for the text iDevice
idevices/text/exequextsq.svg 1.3 KB  Decorative quote-mark SVG used by the text iDevice
```

Every iDevice type that appears in the project ships a subdirectory under `idevices/`.
This fixture uses only the `text` iDevice, so only `idevices/text/` is present. If the
project also used a `quiz` iDevice there would also be an `idevices/quiz/` directory. The
files are copied from `public/files/perm/idevices/base/<type>/` at export time.

See [../idevices/snippets.md](../idevices/snippets.md) for iDevice HTML/JSON shape
documentation.

---

## Totals

| Section | Files | Approx. uncompressed size |
|---------|-------|---------------------------|
| Root (`content.xml`, `content.dtd`, `index.html`, `screenshot.png`, `search_index.js`) | 5 | 116 KB |
| `html/` | 5 | 25 KB |
| `content/css/` | 1 | 13 KB |
| `content/img/` | 1 | 2 KB |
| `theme/` (root files + `img/`) | 6 | 46 KB |
| `theme/icons/` | 50 | 110 KB |
| `libs/` (jQuery, Bootstrap, common.js, common_i18n.js, exe_export.js, favicon) | 9 | 1.45 MB |
| `libs/exe_atools/` | 14 | 650 KB |
| `idevices/text/` | 4 | 10 KB |
| **Total** | **95** | **~2.4 MB uncompressed** |

The bulk of the archive (over 80 %) is the runtime libraries (Bootstrap + exe_atools).
For a project that uses uploaded media, the `content/resources/` tree dominates instead.
