# iDevice `config.xml` Schema

Every iDevice type ships a `config.xml` file located at:

```
public/files/perm/idevices/base/<type>/config.xml
```

This file is metadata only. It tells the eXeLearning runtime how to load, render, and export the iDevice. The actual interactive logic lives in the JS, CSS, and HTML template files referenced by `<edition-*>` and `<export-*>` elements.

See also:
- [catalog.md](catalog.md) — complete iDevice type catalog with values sourced from these files
- [patterns.md](patterns.md) — how iDevices store their state in `content.xml`
- [doc/development/styles.md](../../development/styles.md) — theming and CSS class conventions

---

## Element reference

| Element | Required | Type | Description |
|---------|----------|------|-------------|
| `<idevice>` | yes | element | Root element. All other elements are direct children. |
| `<name>` | no | string | Internal programmatic name. When absent the runtime uses the directory name as the type identifier. Usually matches the directory name (e.g. `text`, `digcompedu`). |
| `<title>` | yes | string | Human-readable display name shown in the iDevice panel. Localised at runtime by the i18n layer. |
| `<css-class>` | yes | string | CSS class added to the iDevice's root `<div>` in both the editor and exports. Conventionally equals the type name. Used by themes for per-type styling; see [styles.md](../../development/styles.md). |
| `<category>` | yes | string | Category group shown in the iDevice panel. One of: `Information and presentation`, `Interactive activities`, `Games`, `Assessment and tracking`, `Science`. |
| `<icon>` | yes | element | Container for icon metadata. Has three children: `<name>` (CSS/icon identifier), `<url>` (SVG filename relative to the iDevice directory), `<type>` (always `img` for SVG icons). Older iDevices may use a bare string value (e.g. `<icon>lightbulb</icon>`) instead of the structured form. |
| `<icon>/<name>` | yes* | string | Icon identifier (e.g. `text-icon`). Used as a CSS class or aria-label. |
| `<icon>/<url>` | yes* | string | Filename of the SVG icon (e.g. `text-icon.svg`). Resolved relative to the iDevice directory. |
| `<icon>/<type>` | yes* | string | Always `img` for SVG-based icons. |
| `<version>` | no | string | iDevice version string (e.g. `1.0`). Informational only; not used for compatibility checks. |
| `<api-version>` | no | string | API contract version. `3.0` indicates the iDevice supports the modern edition/export lifecycle (JS component, JSON state, HTML template). Absent on legacy or simple iDevices. |
| `<component-type>` | no | enum | Specifies how the editor manages state. `json` means the editor reads/writes `jsonProperties` in `content.xml`. Other possible values are `html` (editor manages HTML directly). Absent on iDevices that do not follow the api-v3 lifecycle. |
| `<location>` | no | string | Placeholder field. Present on api-v3 iDevices; value is the literal string `location`. Not used by the runtime. |
| `<location-type>` | no | string | Placeholder field. Present on api-v3 iDevices; value is the literal string `location type`. Not used by the runtime. |
| `<edition-js>` | no | element | JS file(s) loaded in the editor for this iDevice. Contains one or more `<filename>` children. Paths are relative to the iDevice directory. |
| `<edition-js>/<filename>` | no | string | Filename of an editor JS file (e.g. `text.js`). May repeat for multiple files. |
| `<edition-css>` | no | element | CSS file(s) loaded in the editor. Contains one or more `<filename>` children. |
| `<edition-css>/<filename>` | no | string | Filename of an editor CSS file (e.g. `text.css`). May repeat. |
| `<export-js>` | no | element | JS file(s) bundled into exports (HTML5, SCORM, EPUB3). Contains one or more `<filename>` children. A type may bundle third-party libraries here (e.g. `image-gallery` bundles `simple-lightbox.min.js`). |
| `<export-js>/<filename>` | no | string | Filename of an export JS file. May repeat. |
| `<export-css>` | no | element | CSS file(s) bundled into exports. Contains one or more `<filename>` children. |
| `<export-css>/<filename>` | no | string | Filename of an export CSS file. May repeat. |
| `<export-template-filename>` | no | string | Filename of the Nunjucks/HTML template used to render the iDevice in exports (e.g. `text.html`). |
| `<export-object>` | no | string | JavaScript global variable name used by the export engine to call into the iDevice's export logic (e.g. `$Digcompedu`). Rarely present. |
| `<author>` | no | string | Author name. Informational; appears in iDevice metadata UI. |
| `<author-url>` | no | string | URL to the author's page. Informational. |
| `<license>` | no | string | License identifier (e.g. `AGPL-3.0-or-later`). Informational. |
| `<license-url>` | no | string | URL to the license text. Informational. |
| `<description>` | no | string | Short description of the iDevice's purpose. May be empty. Shown in the iDevice panel tooltip and (for downloadable iDevices) in the download listing. |
| `<downloadable>` | yes | `0` or `1` | Whether the iDevice can be downloaded as a standalone package from the iDevice store. `1` means downloadable. All built-in iDevices currently have `0` except `example` which has `1`. |
| `<default-visibility>` | no | `0` or `1` | When `0`, the iDevice is hidden from the iDevice panel by default and only visible in developer/advanced mode. Used by `example`. |

\* Required when `<icon>` uses the structured child-element form rather than the legacy bare-string form.

---

## Annotated example: `text/config.xml`

This is the `text` iDevice, the simplest full api-v3 iDevice. File location: `public/files/perm/idevices/base/text/config.xml`.

```xml
<?xml version="1.0"?>
<idevice>
    <!-- Internal identifier; matches the directory name -->
    <name>text</name>

    <!-- Display title shown in the iDevice panel -->
    <title>Text</title>

    <!-- CSS class on the iDevice root div; used for theme overrides -->
    <css-class>text</css-class>

    <!-- Panel category -->
    <category>Information and presentation</category>

    <!-- SVG icon descriptor -->
    <icon>
        <name>text-icon</name>
        <url>text-icon.svg</url>
        <type>img</type>
    </icon>

    <!-- Version strings -->
    <version>1.0</version>
    <api-version>3.0</api-version>

    <!-- State management: reads/writes jsonProperties in content.xml -->
    <component-type>json</component-type>

    <!-- Placeholder fields (required by api-v3 schema but unused at runtime) -->
    <location>location</location>
    <location-type>location type</location-type>

    <!-- Editor assets: loaded when the user opens this iDevice for editing -->
    <edition-js>
        <filename>text.js</filename>
    </edition-js>
    <edition-css>
        <filename>text.css</filename>
    </edition-css>

    <!-- Export assets: bundled into every exported package -->
    <export-js>
        <filename>text.js</filename>
    </export-js>
    <export-css>
        <filename>text.css</filename>
    </export-css>

    <!-- Nunjucks template used to render the iDevice in exports -->
    <export-template-filename>text.html</export-template-filename>

    <!-- Authorship/licensing metadata (informational) -->
    <author>author</author>
    <author-url>author url</author-url>
    <license>license</license>
    <license-url>license url</license-url>

    <!-- Description shown in panel tooltip -->
    <description>Text component for bootstrap functionalities</description>

    <!-- Not downloadable from iDevice store -->
    <downloadable>0</downloadable>
</idevice>
```

---

## Annotated example: `image-gallery/config.xml`

This example shows multiple `<filename>` entries in `<export-js>` and `<export-css>` for a type that bundles a third-party library (`simple-lightbox`).

```xml
<?xml version="1.0"?>
<idevice>
    <name>image-gallery</name>
    <title>Image gallery</title>
    <css-class>image-gallery</css-class>
    <category>Information and presentation</category>

    <icon>
        <name>image-gallery</name>
        <url>image-gallery-icon.svg</url>
        <type>img</type>
    </icon>

    <version>1.0</version>
    <api-version>3.0</api-version>
    <component-type>json</component-type>
    <location>location</location>
    <location-type>location type</location-type>

    <edition-js>
        <filename>image-gallery.js</filename>
    </edition-js>
    <edition-css>
        <filename>image-gallery.css</filename>
    </edition-css>

    <!-- Two JS files bundled in exports: iDevice code + third-party lightbox -->
    <export-js>
        <filename>image-gallery.js</filename>
        <filename>simple-lightbox.min.js</filename>
    </export-js>

    <!-- Two CSS files bundled in exports -->
    <export-css>
        <filename>image-gallery.css</filename>
        <filename>simple-lightbox.min.css</filename>
    </export-css>

    <export-template-filename>image-gallery.html</export-template-filename>

    <author>author</author>
    <author-url>author url</author-url>
    <license>license</license>
    <license-url>license url</license-url>
    <description></description>
    <downloadable>0</downloadable>
</idevice>
```

---

## Minimal config.xml (no api-v3 lifecycle)

Many iDevices — particularly game-type and legacy iDevices — have a minimal `config.xml` that omits `<api-version>`, `<component-type>`, and all `<edition-*>` / `<export-*>` elements. Their JS/CSS is loaded through a different mechanism (the iDevice's own bootstrap script). Example (`crossword/config.xml`):

```xml
<?xml version="1.0"?>
<idevice>
    <title>Crossword</title>
    <css-class>crossword</css-class>
    <category>Games</category>
    <icon>
        <name>crossword-icon</name>
        <url>crossword-icon.svg</url>
        <type>img</type>
    </icon>
    <downloadable>0</downloadable>
</idevice>
```

For these iDevices the runtime infers the type name from the directory name. State storage follows Pattern 2 (URI-encoded DataGame); see [patterns.md](patterns.md).

---

## Downloadable iDevice example: `example/config.xml`

The `example` iDevice demonstrates all optional fields, including `<downloadable>1</downloadable>` and `<default-visibility>0</default-visibility>`. It is intended as a developer bootstrap template. File: `public/files/perm/idevices/base/example/config.xml`.

```xml
<?xml version="1.0"?>
<idevice>
    <name>example</name>
    <title>Example</title>
    <css-class>example</css-class>
    <category>Information and presentation</category>
    <icon>lightbulb</icon>   <!-- legacy bare-string icon form -->
    <version>1.0</version>
    <api-version>3.0</api-version>
    <component-type>json</component-type>
    <location>location</location>
    <location-type>location type</location-type>
    <edition-js>
        <filename>example.js</filename>
    </edition-js>
    <edition-css>
        <filename>example.css</filename>
    </edition-css>
    <export-js>
        <filename>example.js</filename>
    </export-js>
    <export-css>
        <filename>example.css</filename>
    </export-css>
    <export-template-filename>example.html</export-template-filename>
    <author>author</author>
    <author-url>author url</author-url>
    <license>license</license>
    <license-url>license url</license-url>
    <description>Example component for bootstrap functionalities</description>
    <!-- Downloadable from iDevice store -->
    <downloadable>1</downloadable>
    <!-- Hidden in panel by default; visible only in developer mode -->
    <default-visibility>0</default-visibility>
</idevice>
```

---

## Notes for iDevice authors

- The `config.xml` is never shipped inside exported packages. It is read by the editor at load time to register the iDevice type.
- `<edition-js>` and `<edition-css>` files are loaded only inside the editor iframe. They must not assume a global document context outside the editor panel.
- `<export-js>` and `<export-css>` files are copied verbatim into every exported package. Keep them self-contained and free of editor-only APIs.
- The `<css-class>` value becomes the BEM block name for theme authors. Themes can override per-iDevice styles using `.exe-<css-class>` selectors. See [styles.md](../../development/styles.md).
- `<description>` is the text surfaced in the iDevice help tooltip. Write it in English; the i18n pipeline picks it up via `make translations`. See [doc/development/internationalization.md](../../development/internationalization.md).
