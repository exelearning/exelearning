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

### The shared icon set

Every bundled style ships **the same 50 icons under the same names** — `activity`,
`agreement`, `alert`, … `video`. Only the artwork and the file format differ: `base` and
`neo` ship `.png`, the others `.svg`.

That is a contract, not a coincidence. A block stores its icon by **base name, without the
extension**, and each style resolves that name to whichever file it happens to ship
(`setThemeIconFiles()` in `src/shared/export/renderers/IdeviceRenderer.ts`, falling back to
`<name>.png`). So an author can switch from one style to another and every block keeps its
icon — no re-picking — as long as both styles use the same names. The names also mean the
same thing everywhere: each icon symbolises the same idea in every style, and only the
drawing changes.

**Copy the names from `public/files/perm/themes/base/base/icons/`** when you build your own
style. A name only your style has does work, but it turns into a missing icon the moment the
author switches style.

### The exception: `universal`

`universal` deliberately does not use the shared set. It ships **85 icons**, all `.svg`, from
a collection aligned with the three principles of **Universal Design for Learning (UDL)**,
and colours the whole block from the icon's file name:

| Prefix | UDL principle | Accent |
|--------|---------------|--------|
| `udl_eng_*` | Engagement | green (`#418211`) |
| `udl_rep_*` | Representation | purple (`#9c4fc0`) |
| `udl_exp_*` | Action & Expression | blue (`#0065ab`) |
| `udl_sup_*` | — | none; the same subjects again, left in the style's default box colours |

The colouring is done in `style.css` with `:has()` on the file name, so choosing the icon is
what selects the block's palette:

```css
.exe-export .box:has(.box-icon img[src*="eng_"]) .box-head {
    background: #f4fcf0;
}
```

Because those names are its own, switching between `universal` and any other style is the one
case where the author does have to choose the icons again.

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
This is the one declaration that makes the two groups agree — without it the tint falls
back to the application's own `--icon-primary` green, which will not match your artwork:

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

### Which colour the icon picker actually uses

**No style is named anywhere in the application.** There is no table of per-style colours
in the core: the picker tint comes from CSS your style declares, and a style you write
yourself is read exactly like the seven that ship with eXeLearning. Whatever the bundled
styles achieve, yours can achieve with the same declarations — and nothing you leave out
is filled in for you by name.

The picker resolves the accent in JavaScript (`getCurrentThemeIconColor()` in
`public/app/workarea/project/idevices/content/blockNode.js`). It reads the block header, the
block title and the icon element in turn, and takes the first value it finds:

```
--exe-icon-picker-color  →  --exe-icon-color  →  --icon-primary  →  computed color  →  #6E9F41
```

Only the first two are yours to set. `--icon-primary: #6E9F41` is declared on `:root` in
`assets/styles/abstracts/_variables.scss`, so it is inherited by every element in the editor
and always resolves — which makes the last two steps a safety net the editor never reaches
in practice.

⚠️ **A style that declares neither `--exe-icon-picker-color` nor `--exe-icon-color` gets
the application's green**, whatever its own palette is. Green is not a missing value, it is
an inherited one, and it will sit next to your Style icons in the same picker: pink artwork
beside green glyphs. Declare `--exe-icon-color`, and sample it from your `icons/` artwork
rather than guessing from the palette; the two are often not the same colour.

### Checklist: owning your block icons from CSS alone

Everything below lives in your `style.css`. Nothing needs a change in the application.

| Goal | Declare |
|---|---|
| General icons match your Style artwork | `--exe-icon-color` on `.exe-content` |
| Block header needs a light icon on a coloured band | keep `--exe-icon-color` light, add `--exe-icon-picker-color` with a tint readable on the picker's light chips |
| Paint the header icon itself | `.exe-content .box-head .box-icon { color: var(--exe-icon-color); }` |
| Recolour your **Style** `<img>` artwork inside the picker | a `filter` chain on `.modal #change-block-icon-modal-content .option-block-icon.exe-icon img` — never on the chip, and never on the General icons |
| Resize the icons in exports | `.exe-content .box-icon img` and `.exe-content .box-icon .exe-material-icon` |
| Resize them in the editor | the same pair under `#node-content-container.exe-content .box-head .exe-icon …` |
| Multi-hued Style artwork that no single tint can match | pick one tint and declare it anyway — `neo` and `universal` do exactly this; changing your mind later is a one-line edit in your own stylesheet |

The one thing CSS cannot do for you is tint an `<img>` without a filter, which is why the
Style/General split exists at all. Everything else about the presentation of both groups —
colour, size, scale, dark mode, picker appearance — is yours.

### The editor is a second surface, with a stronger selector

The editor content pane is `<section id="node-content-container" class="exe-content …">` —
both on one element, so every `.exe-content` rule is already live in the editor. But the
workarea stylesheet writes `#node-content-container.exe-content .box-head …`, which outranks
any plain `.exe-content` rule. Where the editor disagrees with the preview, that is almost
always why: match the application's own selector to override it (equal specificity is enough,
since the style loads last).

`universal` is the worked example — it sizes the icons once for the export and once for the
editor, and keeps the `<img>` and the span in step in both:

```css
/* Export */
.exe-content .box-icon img {
    width: 50px;
    height: auto;
    scale: 0.9;
}
.exe-content .box-icon .exe-material-icon {
    width: 50px;
    height: 50px;
    scale: 0.9;
    /* …mask declarations… */
}

/* Editor */
#node-content-container.exe-content .box-head .exe-icon img {
    height: 45px;
    scale: 1;
}
#node-content-container.exe-content .box-head .exe-icon .exe-material-icon {
    width: 45px;
    height: 45px;
    scale: 1;
    /* …mask declarations… */
}
```

Note what it does **not** do: it never restates `transform: scale(1.2)`. The default rule
already carries it, and `scale: 0.9` composes with it, so the span lands at `0.9 × 1.2` while
the `<img>` lands at `0.9` — which is exactly the 24/20 correction the glyph needs.

### `mask-image` needs a server

General icons are painted with `mask-image`, which **does not work over `file://`**. An
export opened straight from disk loses them while the `<img>` Style icons survive. Test
exports over `http://`, not by double-clicking `index.html`.

### Reference styles for the icons

`base` and `universal` (in `public/files/perm/themes/base/`) are the two styles kept in step
with the application. `base` declares `--exe-icon-color: #d86e41` and paints
`.exe-content .box-head .box-icon` with it, then sizes the span once under `.exe-export`;
`universal` adds the editor rules above and a variable-based dark mode. `base` ships **no**
dark mode, which makes it the cleaner reference for everything else.

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

## Effects (FX)

The Accordion, Tabs, Pagination, Carousel and Timeline effects are styled by
`exe_effects.css`, which ships with eXeLearning. Every effect is wrapped in
`<div class="exe-fx exe-...">`.

Their controls (tab labels, page numbers, carousel arrows, accordion titles and the
timeline markers) are links, but **not links inside a block of text**. `exe_effects.css`
therefore keeps them free of underlines and gives them a focus ring of its own, so a
keyboard user always sees where the focus is, whatever style is applied.

The ring is drawn with `outline`, outside the control, over the page background. To
recolour it, set one custom property rather than restyling every control:

```css
.exe-content {
    --exe-fx-focus-color: #054d4d; /* default: #1a1a1a */
}
```

Keep at least a 3:1 contrast ratio between that colour and the page background. Paint
the controls themselves with `background` or `box-shadow` — the ring never uses
`box-shadow`, so both keep working together.

To recolour the controls, target `.exe-content .fx-tabs a` and
`.exe-content .fx-pagination a`: the carousel pagination carries the `fx-pagination`
class too, so it needs no rule of its own.

Careful with the current page, which is a **filled chip**: `exe_effects.css` gives it a
dark background *and* white text, and a rule that recolours every pagination link is more
specific than that pair, so it repaints the text and leaves it on the dark chip. Either
exclude it or restyle the whole chip:

```css
/* Leave the chip alone... */
.exe-content .fx-pagination li:not(.fx-current) a {
    color: #b14900;
}
/* ...or give it both halves of the pair */
.exe-content .fx-pagination .fx-current a {
    background: #145cb1;
    color: #ffffff;
}
```

### What the sheet owns, and what your style should not restate

`exe_effects.css` now owns two things for every FX control, in every export format:

- **No underline in any state** — the controls are not links inside prose (WCAG 1.4.1).
- **The focus ring** on `:focus-visible`, drawn with `outline` and tinted by
  `--exe-fx-focus-color`.

So a style written before this does not need its own `:focus-visible` outlines for
`.fx-tabs a`, `.fx-pagination a` or `.fx-carousel-pagination a`, nor its
`text-decoration: none` workarounds: one `--exe-fx-focus-color` replaces the lot.

Two things are now defects rather than harmless leftovers:

- **`outline: none` / `outline: 0`** on anything matching `.fx-*`, `.exe-accordion`,
  `.exe-tabs`, `.exe-paginated`, `.exe-carousel` or `.exe-timeline`. It suppresses the ring
  the sheet guarantees, and the keyboard user loses the focus indicator.
- **`overflow: hidden` or `overflow: auto` on an FX container.** The ring is drawn *outside*
  the control, so a clipping ancestor cuts it off. `exe_effects.css` dropped `overflow` from
  `.fx-tabs` and `.fx-carousel-pagination` (a clearfix `:after` does the job instead) and
  reopens the accordion while a title has focus:
  ```css
  .js .exe-accordion:has(.fx-accordion-title:focus-visible){overflow:visible}
  ```

**Keep the underline on `.fx-timeline-minor h3 a`.** Those are plain text links inside the
event list, not controls, and the sheet keeps them underlined on purpose.

### `#efefef` is the surface that binds your link colour

`exe_effects.css` paints `#efefef` in **five** places: the current tab's label, the tab
panel, every pagination chip, the paginated page panel and the carousel panel. Three of
those hold author prose — links included — and the chips are links themselves. So
`.exe-content a` lands on `#efefef` in any project that uses an effect, and that surface,
not white, is what your link colour has to clear: **4.5:1 on `#efefef`** is appreciably
darker than 4.5:1 on white.

Do not buy back a brighter link with a rule scoped to the tabs. It is not one special case
but five components and the prose inside three of them, so the exception would end up wider
than the rule. Measure on `#efefef` and pick one colour. The `base` style is the worked
example — `#b14900` on the controls, `#973f00` on hover/focus.

### The carousel pagination is not a separate component

Its list carries **both** `fx-carousel-pagination` and `fx-pagination`, and the duplicated
link rules were removed from `exe_effects.css` accordingly. A third selector for
`.fx-carousel-pagination a` alongside `.fx-pagination a` is therefore duplication.

`.fx-carousel-pagination` on its own is **not** dead: it still positions the prev/next
arrows and sets their font size. Do not delete rules that use it for layout.

### Reference styles for the effects

`base` and `universal` are also the two styles kept up to date with this sheet; read their
`style.css` before writing your own FX rules. They show the two correct shapes for the
current chip — `base` excludes it, `universal` restyles it whole:

```css
/* base */
.exe-content .fx-tabs a,
.exe-content .fx-pagination li:not(.fx-current) a {
    color: #b14900;
}
.exe-content {
    --exe-fx-focus-color: #054d4d;
}

/* universal */
.exe-content .fx-tabs a,
.exe-content .fx-pagination a {
    color: #145cb1;
}
.exe-content .fx-pagination .fx-current a {
    background: #145cb1;
    color: #ffffff;
}
.exe-content {
    --exe-fx-focus-color: #0d70c7;
}
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

### Rewriting URLs: use `$exeExport.setUrlParam`

A style that carries its own state across navigation — `nav=false` for a collapsed menu is
the usual one — has to add and remove a query parameter on links the **application**
generated. Never split the string yourself. `libs/exe_export.js`, which every export format
loads, provides:

```js
$exeExport.setUrlParam(href, name, value)
```

It sets one parameter, **keeps every other parameter and the fragment**, and removes the
parameter when `value` is `null`. A pure fragment (`#ancla`) is returned untouched, because
adding a query there would turn an in-page jump into a page load. The value is used as
given, so encode it yourself when it needs it (the export's own search does
`encodeURIComponent(this.query)` for `q`).

**Why it matters:** those URLs are a shared channel. Through them travel `exe-teacher` /
`teacher-mode`, the search term `q`, `print=1`, and the xAPI launch parameters `endpoint`,
`auth`, `actor` and `registration`. Wiping the query breaks LMS tracking and teacher mode,
and nothing on screen says so. The three broken patterns all survive a casual test, because
sample content usually has no other parameter:

```js
e.href = ref.split('?')[0];                       // drops every parameter AND the fragment
e.href = ref + (cond ? '&' : '?') + 'nav=false';  // guesses the separator; a second '?'
window.location = this.href + '?nav=false';       // lands inside the fragment if there is a #ancla
```

Two more rules that go with it:

- **Operate on `getAttribute('href')`, not the `.href` property**, which absolutises the
  relative links the export writes.
- **Read the current value with `URLSearchParams`**, not by searching the string:
  `indexOf('nav=false')` also matches `?xnav=false` and any fragment containing that text.

`base` is the reference implementation — detection in `init()`, and one `params()` helper
that both adds and removes:

```js
if (new URLSearchParams(window.location.search).get('nav') === 'false') {
    $('body').addClass('siteNav-off');
    myTheme.params('add');
}

// Toggle nav=false keeping the rest of the URL using a common function.
params: function (act) {
    var value = act == 'add' ? 'false' : null;
    $('.nav-buttons a').each(function () {
        this.setAttribute(
            'href',
            $exeExport.setUrlParam(this.getAttribute('href'), 'nav', value)
        );
    });
},
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
