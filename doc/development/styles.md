# Creating a Style for **eXeLearning**

## Minimum Required Elements of a Style

A style must include at least the following elements:

| Element        | Description |
|----------------|-------------|
| `config.xml`      | Main configuration file. |
| CSS files         | Visual styling of the content. |
| JS files          | JavaScript functionality for the style (optional). |
| `screenshot.png`  | Preview image (screenshot). |
| `icons/`          | Folder containing iDevice icons. |

---

## The `config.xml` File

Example structure:

```xml
<?xml version="1.0"?>
<theme>
  <name>example</name>
  <title>Example</title>
  <version>2025</version>
  <compatibility>3.0</compatibility>
  <author>eXeLearning.net</author>
  <license>Creative Commons by-sa</license>
  <license-url>http://creativecommons.org/licenses/by-sa/3.0/</license-url>
  <description>Example style for eXe.

iDevice icons by…</description>
</theme>
```

### File Fields

- **`name`**: Internal name (ID) and folder name of the style (no spaces or special characters).
- **`title`**: Name displayed in the style selector in eXeLearning.
- **`version`**: Version number of the style.
- **`compatibility`**: eXeLearning version the style is compatible with.
- **`author`**, **`license`**, **`license-url`**: Author and licensing information.
- **`description`**: Style description (may include line breaks).

---

## CSS Files

- Placed in the root folder of the style.
- You may include one or multiple files (`style.css` is required).
- If multiple files exist, they are loaded **in alphabetical order**.

---

## JavaScript (JS) Files

- Placed in the root folder of the style.
- You may include multiple JS files (most styles use a single `style.js`); they are also loaded **alphabetically**.
- JavaScript **does not run inside eXeLearning**, it only runs after exporting the content.

---

## Screenshot (`screenshot.png`)

- Required name: `screenshot.png`.  
- Location: root folder.  
- Recommended size: **1200×550 px**.

---

## `icons/` Folder

- Contains images for iDevice icons.  
- Supported formats: `.gif`, `.png`, `.jpg`, `.svg`.  

---

## Block Icons: Style Icons and General Icons

The icon picker offers two groups. **Style icons** are the artwork your `icons/`
folder ships. **General icons** are Google Material Symbols, bundled with the
application and shared by every style.

A General icon is not an `<img>`. It is a `<span class="exe-material-icon">` whose
glyph is applied as a CSS mask and painted with `currentColor`:

```html
<span class="exe-material-icon" style="--exe-material-icon-url:url('data:image/svg+xml;utf8,…');"></span>
```

**Your style does not have to do anything for these icons to work.** The application
ships a default rule — `content/css/base.css` in exports, the workarea stylesheet in
the editor — that sizes the span to 40×40 and applies the mask. It loads before
`theme/style.css`, so you only override what you want to change.

> **The export wrapper is `<div class="exe-content exe-export …">`** — both classes on
> the same element. A `.exe-content` rule is therefore live in exports too, and an
> `.exe-export` rule of equal specificity does not replace it, it just wins property by
> property. Do not restate the size in the `.exe-export` rule unless you mean to change
> it there.

### Matching them to your own artwork

Set `--exe-icon-color` so General icons take the same colour as your Style icons.
Without it the tint falls back to the computed text colour of the block header, which
may not match your artwork at all:

```css
.exe-content {
    --exe-icon-color: #d86e41;
}

.exe-content .box-head .box-icon {
    color: var(--exe-icon-color, #d86e41);
}
```

If that colour is light — because your block header has a coloured background — set
`--exe-icon-picker-color` as well. The icon picker paints its chips on a light
background, so a white `--exe-icon-color` would leave both the icons and the selected
state invisible there. The picker prefers this variable when it is present:

```css
.exe-content {
    --exe-icon-color: #fff;         /* white icon on the coloured block header */
    --exe-icon-picker-color: #0d77d1; /* readable on the picker's light chips */
}
```

The variable reaches the General icons, because they are painted with `currentColor`.
It cannot reach your Style icons: those are `<img>` artwork, and only a filter can
recolour an image. If your artwork is a flat light colour, `brightness(0)` flattens it
to black and an invert/sepia/saturate/hue-rotate chain takes it to the accent, so both
groups match in the picker. The `educablue` style is a worked example:

```css
.modal #change-block-icon-modal-content .option-block-icon.exe-icon img {
    filter: brightness(0) saturate(100%) invert(50%) sepia(40%) saturate(1164%)
        hue-rotate(171deg) brightness(77%) contrast(119%);
}
```

To change the size, redefine the span. Keep `transform: scale(1.2)`: Material Symbols
are drawn inside a 20px live area on a 24px grid, so without it the glyph renders
about 17% smaller than edge-to-edge Style icons.

Note that the individual `scale` property **composes with** `transform` rather than
replacing it: a rule setting `scale: 0.9` and another setting `transform: scale(1.2)`
leave the element at `0.9 × 1.2`. If your style already uses `scale`, account for it.

```css
.exe-content .box-icon .exe-material-icon {
    width: 50px;
    height: 50px;
    transform: scale(1.2);
}
```

### Two things that will break your icons

- **Dark mode by global inversion.** If your style does
  `html.exe-dark-mode { filter: invert(…) }` and then counter-inverts the media with
  `:is(img, video, iframe)`, name the span too — it is not an `<img>`, so otherwise
  your General icons invert while your Style icons do not. Only do this when your
  Style icons are light artwork; if `--exe-icon-color` is already a dark colour meant
  to invert to a light one, leave the span out of that list.
- **Filtering the icon picker.** If your style restyles
  `#change-block-icon-modal-content .option-block-icon`, never put the rule on the chip
  itself — it has a background, so a `filter` there paints a solid block over the icon.
  Scope it to the `img` inside, and leave the General icons out: they are inline `<svg>`
  filled with `currentColor`, so `--exe-icon-picker-color` already reaches them and
  filtering them too fights it.

---

## Optional Files and Folders

You can add other useful folders such as:

- `fonts/` → Fonts (`.woff`, `.woff2`, etc.)  
- `img/` → Additional images. If this folder contains `favicon.png` or `favicon.ico`, exports will use it instead of the default eXeLearning favicon.

Example usage in CSS:

```css
#siteNav a {
  background: #191748 url(img/example.svg) no-repeat 8px center;
  padding-left: 42px;
}
```

---

## CSS and Exported Content

All exported content is wrapped in a `<div class="exe-content">`.  
Using this class ensures your CSS does **not interfere with the eXeLearning interface**.

**Incorrect:**
```css
h2 { color: red !important; }
```

**Correct:**
```css
.exe-content h2 { color: red !important; }
```

---

## CSS Classes by Export Type

Each export type adds a CSS class to the `<body>` element:

| Export Type        | Body Class      |
|--------------------|------------------|
| Website            | `exe-web-site`   |
| SCORM              | `exe-scorm`      |
| EPUB               | `exe-epub`       |
| IMS                | `exe-ims`        |
| Single HTML page   | `exe-single-page`|

All export formats also include the general class **`exe-export`**.  
Example:  
```html
<body class="exe-export exe-web-site">
```

---

## Empty Site Footer

Every page ends with `<footer id="siteFooter">`, which holds the license and the
content of the **Page footer** project property. When a project has neither — no
license to display (empty, *propietary* or *not appropriate*) and a **Page footer**
that is empty or whitespace only — the footer is rendered with an extra class:

```html
<footer id="siteFooter" class="siteFooter-empty"><div id="siteFooterContent"></div></footer>
```

`content/css/base.css` hides those footers, so a theme that gives `#siteFooter` a
background, border or padding does not show a stray empty bar.

The element stays in the DOM on purpose: a theme that wants to keep showing the
footer area even when it is empty (a decorative bottom band, for instance) can opt
out with a rule of equal or higher specificity:

```css
#siteFooter.siteFooter-empty {
    display: block;
}
```

---

## JavaScript in Styles

You can use jQuery (already included in exported content).  
Common functionality found in built-in eXe styles:

- Toggle menu visibility.
- Remember menu open/closed state between pages.
- Show/hide the search bar.
- **Teacher mode** visibility. Content marked *teacher only* is **hidden by default** in
  exports. The self-serve toggle button is **opt-in**: it only appears when the page is opened
  with `?exe-teacher=1` (alias `?teacher-mode=1`, or the legacy `?exe-teacher-toggler=1`). The
  toggle is OFF by default — the viewer activates it to add the `mode-teacher` class to
  `<html>` and reveal teacher content (its state is remembered in `localStorage`). Without the
  parameter there is no toggle and teacher content stays hidden. eXeLearning's own preview
  loads with `?exe-teacher=1`, so the toggle is available there. See
  [Teacher Mode in embedding.md](./embedding.md#teacher-mode).
  ```js
  // Themes can still trigger the (opt-in) toggle setup explicitly:
  $exeExport.teacherMode.init();
  ```

---

## Final Recommendations

- Export in different formats: **SCORM, Web, Single HTML Page** to test compatibility.
- Adjust your CSS and JS so the style works consistently across all export types.
- Package the style into a `.zip` file:
  - The `.zip` file name must match the `<name>` in `config.xml`.
  - The `.zip` must not contain extra parent folders — all files (`config.xml`, CSS, JS, `icons/`, etc.) must be in the root.

---

### How to Create a New Style Easily

- Download any of the styles included in eXeLearning. Choose the one that most closely resembles what you want to achieve.  
- Unzip the `.zip` folder.  
- Edit the `config.xml` file to modify all the information you need.  
- Follow the steps described in the **"Final Recommendations"** section to complete the creation of your style.

---

## Theme Types

eXeLearning has three types of themes:

| Type | Source | Storage | Served By |
|------|--------|---------|-----------|
| **Base** | Built-in with eXeLearning | Server `/perm/themes/base/` | Server |
| **Site** | Admin-installed for all users | Server `/perm/themes/site/` | Server |
| **User** | Imported by user or from .elpx | Client IndexedDB + Yjs | **Never server** |

---

## Deployment Information

### Base themes (built-in)

The styles included by default in eXeLearning are located in:

```
/public/files/perm/themes/base/
```

These are synchronized at server startup and cannot be modified by users.

> **After editing a base style, run `bun run bundle:resources`.** The editor's preview
> loads themes from pre-built ZIP bundles under `public/bundles/themes/`, not from the
> source folder, so until you rebuild them the preview keeps showing the previous CSS
> even though the server serves the new file.

### Site themes (admin-installed)

Administrators can install themes for all users by placing them in:

```
/perm/themes/site/
```

Site themes can be:
- Activated/deactivated by the administrator
- Set as the default theme for new projects

### Using custom styles with Docker

To bind a custom style directly in `docker-compose.yml`, add the following volume:

```yaml
volumes:
  - ./my-theme:/mnt/data/perm/themes/base/my-theme:ro
```

Where `./my-theme` is the directory on your host machine containing the style.

This makes the style available to **all users**.

This is required because eXeLearning recreates the entire `/base/` themes directory when restarting the server. Any style not bound as a volume would be overwritten during this process.

---

## User Styles (Client-Side)

> **Important**: User themes are NEVER stored or served by the server.

User styles are imported through the application interface (**Styles → Imported**) and stored entirely on the client side.

### Storage locations

```
IndexedDB (browser, per-user)
└── user-themes store: key = "userId:themeName"
    └── Each user's themes are isolated by userId prefix
    └── Switching users shows only that user's themes

Yjs themeFiles (project document)
└── Currently selected user theme (for collaboration/export)

.elpx export
└── Embedded theme files (for portability)
```

**Per-user isolation**: When user "alice" logs in, she only sees her themes. If "bob" logs in on the same browser, he sees his own themes, not Alice's. This is achieved by storing themes with a composite key `userId:themeName` in IndexedDB.

### How user themes work

1. **Import**: User uploads ZIP → Stored in IndexedDB (local browser storage)
2. **Select**: User selects theme → Copied to Yjs `themeFiles` (for collaboration/export)
3. **Change**: User selects different theme → Removed from Yjs (but kept in IndexedDB)
4. **Export**: If user theme is selected → Embedded in .elpx ZIP
5. **Open**: Another user opens .elpx → Theme extracted to their IndexedDB

### Admin configuration

```bash
# Allow users to import/install styles
ONLINE_THEMES_INSTALL=1    # 1 = enabled (default), 0 = disabled
```

When disabled (`ONLINE_THEMES_INSTALL=0`):
- Users **cannot** import external themes via the interface
- Users **cannot** open .elpx files with embedded themes

### Why user themes are client-side

This design follows the same pattern as other user-specific data (like favorite iDevices):

1. **Per-user storage**: Each user's themes are private to them
2. **No server storage**: Themes don't consume server disk space
3. **Collaboration via Yjs**: Selected theme is shared with collaborators in real-time
4. **Portability**: Themes embedded in .elpx can be opened anywhere
5. **Offline capability**: Themes work without server connectivity
