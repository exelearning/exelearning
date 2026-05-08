# Themes in ELPX Packages

This document describes how themes are bundled inside `.elpx` files: the directory layout, the `config.xml` element reference, the six in-tree themes, fallback behaviour, custom theme portability, and where to find the authoring guide.

> **See also**: [ELPX Format hub](../elpx-format.md) | [Libraries](libraries.md) | [Assets](assets.md) | [Screenshot](screenshot.md) | [Theme authoring guide](../development/styles.md)

---

## 1. Theme bundle layout inside the ZIP

Every exported `.elpx` (and plain HTML5 `.zip`) places the active theme under a top-level `theme/` directory. The layout mirrors the in-tree source directory at `public/files/perm/themes/base/<name>/`.

```
project.elpx (ZIP)
└── theme/
    ├── config.xml          # Theme metadata (name, version, author, …)
    ├── style.css           # Theme stylesheet
    ├── style.js            # Theme JavaScript (navigation, interactions)
    ├── screenshot.png      # THEME preview thumbnail (not the project thumbnail)
    ├── icons/              # iDevice category icons (PNG, one per category)
    │   ├── activity.png
    │   ├── alert.png
    │   └── …
    └── img/                # Theme-specific images (sprites, decorations)
        ├── icons.png
        └── licenses.gif
```

Verified against the unzipped sample at `/tmp/elpx-docs-work/fix-simple/theme/`:

```
theme/config.xml
theme/style.css
theme/style.js
theme/screenshot.png
theme/icons/activity.png
theme/icons/agreement.png
… (48 icon files)
theme/img/icons.png
theme/img/licenses.gif
```

### Distinction: theme screenshot vs. project screenshot

`theme/screenshot.png` is the **theme's own preview image** — used in the eXeLearning UI to show what the theme looks like. It travels with the theme bundle so the importer can display a preview even before the user opens the project.

The project-level `screenshot.png` at the **ZIP root** is the **project thumbnail** (a 1280×720 preview of the actual content). These are two different files with different purposes. See [screenshot.md](screenshot.md) for the project thumbnail specification.

---

## 2. `config.xml` element reference

Each theme directory contains a `config.xml` that declares its identity and licensing terms. The file is valid XML 1.0.

Annotated example — `public/files/perm/themes/base/base/config.xml`:

```xml
<?xml version="1.0"?>
<theme>
    <!-- Internal identifier; must match the directory name -->
    <name>base</name>

    <!-- Human-readable display name shown in the UI -->
    <title>Default</title>

    <!-- Release year / version tag -->
    <version>2025</version>

    <!-- Minimum eXeLearning version required to use this theme -->
    <compatibility>3.0</compatibility>

    <!-- Theme author(s) -->
    <author>eXeLearning.net</author>

    <!-- SPDX-compatible licence name -->
    <license>Creative Commons by-sa</license>

    <!-- Canonical licence URL -->
    <license-url>http://creativecommons.org/licenses/by-sa/3.0/</license-url>

    <!-- Free-text description shown in the theme picker -->
    <description>Minimally-styled, feature rich responsive style for eXe.

iDevice icons by Francisco Javier Pulido Cuadrado.</description>

    <!-- 1 = available for download from the theme repository; 0 = internal only -->
    <downloadable>1</downloadable>
</theme>
```

### Element reference table

| Element | Required | Description |
|---------|----------|-------------|
| `<name>` | Yes | Unique machine identifier. Must equal the containing directory name. Used by `OdeXmlGenerator` and `Html5Exporter` to look up the theme. |
| `<title>` | Yes | Localised display name in the theme picker. |
| `<version>` | Yes | Version string; current in-tree themes use the four-digit year. No strict format enforced. |
| `<compatibility>` | Yes | Minimum eXeLearning version. The exporter uses `3.0` for all current themes. |
| `<author>` | Yes | Attribution text. May include multiple contributors. |
| `<license>` | Yes | Licence short name. |
| `<license-url>` | Yes | Full URL to the licence text. |
| `<description>` | Yes | Multi-line description. May include font and icon attribution. |
| `<downloadable>` | Yes | `1` if users can install the theme from the online repository; `0` for internal/dev themes. |

---

## 3. The six in-tree themes

All six themes ship in `public/files/perm/themes/base/`. Data read from each `config.xml`:

| `name` | `title` | `version` | `compatibility` | `downloadable` | One-line description |
|--------|---------|-----------|-----------------|----------------|----------------------|
| `base` | Default | 2025 | 3.0 | 1 | Minimally-styled, feature-rich responsive theme. iDevice icons by F.J. Pulido. |
| `flux` | Flux | 2025 | 3.0 | 1 | "Energía en movimiento." Fredoka font, Google Material icons. By 3ipunt / Consejería Ed. Canarias. |
| `neo` | Neo | 2025 | 3.0 | 1 | "Innovación con propósito." Nunito font. By 3ipunt for eXeLearning.net. |
| `nova` | Nova | 2025 | 3.0 | 1 | "Aprender, crecer, avanzar." Open Sans font. By 3ipunt / Consejería Ed. Canarias. |
| `universal` | Universal | 2025 | 3.0 | 1 | Accessibility-focused (UDL). Atkinson Hyperlegible font. By Ignacio Gros for EducaMadrid. |
| `zen` | Zen | 2025 | 3.0 | 1 | "Equilibrio y claridad." Inter font, Google Material icons. By 3ipunt for eXeLearning.net. |

---

## 4. Default theme fallback

When no theme is specified (or the project's `meta.theme` field is empty), the exporter falls back to `base`.

This is written in two places:

**`src/shared/export/generators/OdeXmlGenerator.ts:79`** — `content.xml` always records a theme:

```typescript
xml += generateUserPreferenceEntry('theme', meta.theme || 'base');
```

**`src/shared/export/exporters/Html5Exporter.ts:76`** — the HTML5 exporter resolves the theme name before fetching theme files:

```typescript
const themeName = html5Options?.theme || meta.theme || 'base';
```

Priority order: (1) export option parameter, (2) project metadata, (3) hard-coded `'base'`.

If `prepareThemeData(themeName)` fails to find the requested theme (for example, a custom theme that is missing from the resource cache), `Html5Exporter` falls back to inline CSS/JS stubs via `getFallbackThemeCss()` and `getFallbackThemeJs()` (`Html5Exporter.ts:261–265`):

```typescript
} else {
    // Add fallback theme if pre-fetch failed
    addFile('theme/style.css', this.getFallbackThemeCss());
    addFile('theme/style.js', this.getFallbackThemeJs());
}
```

The fallback produces a minimal, unstyled layout so the exported content remains readable even when the preferred theme cannot be resolved.

---

## 5. Custom user themes

Custom themes created or installed by the user are **not** stored on the server filesystem at export time. They live in the browser's IndexedDB resources cache (`exelearning-resources-v1`).

When a project that uses a custom theme is exported:

1. `Html5Exporter.prepareThemeData(themeName)` fetches the theme files from the resource layer (`this.resources`), which is backed by IndexedDB in the browser and by the filesystem in server-side / CLI exports.
2. All theme files (`style.css`, `style.js`, `config.xml`, `screenshot.png`, `icons/`, `img/`) are iterated from `themeFilesMap` and added to the ZIP under `theme/` (`Html5Exporter.ts:256–265`):

```typescript
if (themeFilesMap) {
    for (const [filePath, content] of themeFilesMap) {
        addFile(`theme/${filePath}`, content);
    }
}
```

This makes the package **self-contained**: recipients can view the content in a browser or re-import it into eXeLearning without needing to install the custom theme separately. The theme is fully embedded in the `.elpx`.

On import, `ElpxImporter` reads the theme name from `content.xml` and stores it in the Yjs `metadata` map. The theme files themselves are not extracted back to IndexedDB during import; the importer relies on the embedded HTML output already referencing `theme/style.css` and `theme/style.js` with correct relative paths.

---

## 6. Authoring a new theme

Creating a custom theme involves writing `style.css`, `style.js`, and the supporting files described in section 1.

Full authoring instructions, SCSS compilation steps, and the variable reference are in the dedicated guide:

**[doc/development/styles.md](../development/styles.md)**

This document does not duplicate that content. Refer to `styles.md` for:

- SCSS architecture and variable overrides
- How to register a new theme in the development environment
- Hot-reload workflow during authoring
- Accessibility requirements

---

## 7. Relationship between exported `theme/` and source `public/files/perm/themes/base/<name>/`

The directory structures are identical. The export process copies every file from the source theme directory into the ZIP `theme/` prefix without transformation. There is no build step applied to theme CSS or JS at export time — the files in `public/files/perm/themes/base/<name>/` are already the final production assets.

```
Source:  public/files/perm/themes/base/base/style.css
ZIP:     theme/style.css

Source:  public/files/perm/themes/base/base/icons/activity.png
ZIP:     theme/icons/activity.png
```

Custom themes follow the same convention: wherever the resource layer stores the theme files, they are mapped 1:1 into the `theme/` subtree in the ZIP.
