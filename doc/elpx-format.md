# ELPX Format Documentation (content.xml)

This document describes the modern `.elpx` file format used by eXeLearning v3+. It covers the ZIP structure, the `content.xml` ODE 2.0 schema, all element types, and an annotated example.

> **See also**: For the legacy `.elp` format used by eXeLearning 2.x, see [Legacy ELP Format (contentv3.xml)](contentv3-format.md).

---

## Overview

An `.elpx` file is a **ZIP archive** that contains a complete, self-contained eXeLearning project. It was introduced in eXeLearning v3.0 as a replacement for the legacy `.elp` format. The key difference is that `.elpx` includes both:

- A `content.xml` file in **ODE 2.0 XML** format (re-importable project structure)
- Pre-rendered HTML output (viewable without importing)

This dual nature makes `.elpx` the recommended exchange format: it is human-readable in a browser and re-importable for editing.

---

## ZIP Structure

```
project.elpx (ZIP)
├── screenshot.png            # Project thumbnail/preview image
├── content.xml               # ODE 2.0 project structure (re-importable)
├── content.dtd               # DTD for XML validation
├── index.html                # Entry point (first page rendered as HTML)
├── html/
│   ├── page-title.html       # Additional pages (one file per page)
│   └── ...
├── content/
│   ├── css/
│   │   └── base.css          # Base stylesheet
│   └── resources/
│       ├── image.jpg         # Project assets (images, PDFs, media)
│       └── ...
├── libs/
│   ├── common_i18n.js        # Localized strings
│   └── ...                   # jQuery, Bootstrap, and other libraries
├── theme/
│   ├── style.css             # Theme stylesheet
│   ├── style.js              # Theme JavaScript
│   └── ...
├── idevices/
│   ├── text/                 # Per-iDevice CSS/JS assets
│   └── ...
└── search_index.js           # (optional) Search index when search is enabled
```

**Notes:**
- The first page is always `index.html`; additional pages go in `html/`
- Page filenames are derived from page titles (slugified, collision-safe)
- Assets are stored under `content/resources/` in the export; `content.xml` references them via `{{context_path}}`
- `screenshot.png` is a project 16:9 thumbnail image (1280×720 px recommended at the archive root; external systems can extract it for preview without processing the full package

---

## content.xml Overview

`content.xml` uses the **ODE (Open Digital Education) 2.0** format. It is a native XML document — not a Python object serialization — and can be validated against the bundled DTD.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
  <userPreferences>...</userPreferences>
  <odeResources>...</odeResources>
  <odeProperties>...</odeProperties>
  <odeNavStructures>...</odeNavStructures>
</ode>
```

**Key characteristics:**
- Namespace: `http://www.intef.es/xsd/ode`
- Root element: `<ode>` with optional `version` attribute (currently `"2.0"`)
- HTML content is stored **HTML-escaped** inside `<htmlView>` and `<jsonProperties>` (no CDATA in the standard output; CDATA is used only when the content itself contains `]]>`)
- Page hierarchy is **flat**: parent-child relationships are expressed via `<odeParentPageId>`, not XML nesting

---

## DTD / Formal Schema

The formal DTD is at:

```
public/app/schemas/ode/content.dtd
```

It is also bundled inside every `.elpx` file as `content.dtd`.

---

## ID Format

All ODE identifiers (page IDs, block IDs, iDevice IDs, `odeId`, `odeVersionId`) use the format:

```
YYYYMMDDHHmmss + 6 random uppercase alphanumeric characters
```

**Example:** `20251125215855LURLBW`

- 14-digit timestamp (`YYYYMMDDHHMMSS`)
- 6 characters from `A-Z0-9`

This gives a reasonably unique, time-sortable identifier that is safe to embed in XML and HTML.

---

## Element Reference

### `<ode>` — Root Element

```xml
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
  ...
</ode>
```

| Attribute | Required | Description |
|-----------|----------|-------------|
| `xmlns` | Fixed | Always `http://www.intef.es/xsd/ode` |
| `version` | Optional | ODE format version; currently `"2.0"` |

Contains (in order): `userPreferences?`, `odeResources?`, `odeProperties?`, `odeNavStructures`.

---

### `<userPreferences>` / `<userPreference>`

Stores user-level configuration (currently only the active theme).

```xml
<userPreferences>
  <userPreference>
    <key>theme</key>
    <value>base</value>
  </userPreference>
</userPreferences>
```

Each `<userPreference>` has a `<key>` and `<value>` child. Currently only `theme` is used.

---

### `<odeResources>` / `<odeResource>`

Package-level identifiers and version information.

```xml
<odeResources>
  <odeResource>
    <key>odeId</key>
    <value>20251125215855LURLBW</value>
  </odeResource>
  <odeResource>
    <key>odeVersionId</key>
    <value>20251125220103ABCXYZ</value>
  </odeResource>
  <odeResource>
    <key>eXeVersion</key>
    <value>v3.0.0</value>
  </odeResource>
</odeResources>
```

| Key | Description |
|-----|-------------|
| `odeId` | Stable project identifier (generated once on creation) |
| `odeVersionId` | Changes on every save (tracks the version) |
| `eXeVersion` | eXeLearning version that generated this file |
| `odeVersionName` | Human-readable version label (optional) |
| `isDownload` | `"true"` when project includes download-source-file iDevice |

---

### `<odeProperties>` / `<odeProperty>`

Document metadata. Each property is a `<key>`/`<value>` pair inside `<odeProperty>`.

```xml
<odeProperties>
  <odeProperty>
    <key>pp_title</key>
    <value>My Learning Content</value>
  </odeProperty>
  ...
</odeProperties>
```

#### Standard Property Keys

| Key | Type | Description |
|-----|------|-------------|
| `pp_title` | string | Project title |
| `pp_subtitle` | string | Project subtitle |
| `pp_author` | string | Author name |
| `pp_lang` | string | Language code (e.g., `"en"`, `"es"`) |
| `license` | string | License identifier (e.g., `"creative commons: attribution - share alike 4.0"`) |
| `pp_description` | string | Project description |
| `pp_addExeLink` | boolean | Include "Made with eXeLearning" footer link |
| `pp_addPagination` | boolean | Add page navigation |
| `pp_addSearchBox` | boolean | Include search box |
| `pp_addAccessibilityToolbar` | boolean | Include accessibility toolbar |
| `pp_addMathJax` | boolean | Load MathJax for LaTeX rendering |
| `exportSource` | boolean | Include editable source in export |
| `pp_extraHeadContent` | string (HTML) | Custom `<head>` HTML injected into all pages |
| `footer` | string (HTML) | Custom footer HTML |
| `pp_globalFont` | string | Global font override (e.g., `"default"`) |
| `pp_style` | string | Theme name (also stored in `userPreferences`) |

Boolean values are stored as the strings `"true"` or `"false"`.

---

### `<odeNavStructures>` / `<odeNavStructure>`

Contains all pages of the project as a **flat list**. Parent-child relationships are expressed via `<odeParentPageId>`.

```xml
<odeNavStructures>
  <odeNavStructure>
    <odePageId>20251125215855PAGE01</odePageId>
    <odeParentPageId/>                          <!-- empty = root page -->
    <pageName>Introduction</pageName>
    <odeNavStructureOrder>1</odeNavStructureOrder>
    <odeNavStructureProperties>...</odeNavStructureProperties>
    <odePagStructures>...</odePagStructures>
  </odeNavStructure>
  <odeNavStructure>
    <odePageId>20251125215855PAGE02</odePageId>
    <odeParentPageId>20251125215855PAGE01</odeParentPageId>  <!-- child of PAGE01 -->
    <pageName>Section 1.1</pageName>
    <odeNavStructureOrder>1</odeNavStructureOrder>
    ...
  </odeNavStructure>
</odeNavStructures>
```

#### `<odeNavStructure>` child elements

| Element | Description |
|---------|-------------|
| `<odePageId>` | Unique page identifier |
| `<odeParentPageId>` | Parent page ID, empty for root-level pages |
| `<pageName>` | Page title (used in navigation) |
| `<odeNavStructureOrder>` | Numeric sort order among siblings |
| `<odeNavStructureProperties>` | Page-level properties (see below) |
| `<odePagStructures>` | Blocks contained in this page |

#### Page Properties (`<odeNavStructureProperty>`)

| Key | Type | Description |
|-----|------|-------------|
| `titleNode` | string | Navigation label (may differ from `pageName`) |
| `titlePage` | string | Rendered page heading |
| `titleHtml` | string (HTML) | Custom HTML title override |
| `hidePageTitle` | boolean | Hide the page `<h1>` heading |
| `editableInPage` | boolean | Allow inline title editing |
| `visibility` | boolean | Whether the page is visible |
| `highlight` | boolean | Highlight this page in the navigation |
| `description` | string | Short description for the page |

---

### `<odePagStructures>` / `<odePagStructure>`

Blocks are containers inside a page. Each block can hold one or more iDevice components.

```xml
<odePagStructures>
  <odePagStructure>
    <odePageId>20251125215855PAGE01</odePageId>
    <odeBlockId>20251125215855BLK001</odeBlockId>
    <blockName>Text</blockName>
    <iconName/>
    <odePagStructureOrder>1</odePagStructureOrder>
    <odePagStructureProperties>...</odePagStructureProperties>
    <odeComponents>...</odeComponents>
  </odePagStructure>
</odePagStructures>
```

#### `<odePagStructure>` child elements

| Element | Description |
|---------|-------------|
| `<odePageId>` | ID of the containing page (redundant but required by DTD) |
| `<odeBlockId>` | Unique block identifier |
| `<blockName>` | Human-readable block label |
| `<iconName>` | Optional icon identifier |
| `<odePagStructureOrder>` | Sort order within the page |
| `<odePagStructureProperties>` | Block-level properties |
| `<odeComponents>` | iDevice components in this block |

#### Block Properties (`<odePagStructureProperty>`)

| Key | Type | Description |
|-----|------|-------------|
| `visibility` | boolean | Whether the block is visible |
| `teacherOnly` | boolean | Restrict block to teacher view |
| `allowToggle` | boolean | Allow block to be collapsed |
| `minimized` | boolean | Block starts collapsed |
| `identifier` | string | Optional CSS `id` attribute |
| `cssClass` | string | Optional extra CSS class(es) |

---

### `<odeComponents>` / `<odeComponent>`

Each `<odeComponent>` is an iDevice (interactive learning element).

```xml
<odeComponents>
  <odeComponent>
    <odePageId>20251125215855PAGE01</odePageId>
    <odeBlockId>20251125215855BLK001</odeBlockId>
    <odeIdeviceId>20251125215855IDEV01</odeIdeviceId>
    <odeIdeviceTypeName>text</odeIdeviceTypeName>
    <htmlView>&lt;p&gt;Hello world&lt;/p&gt;</htmlView>
    <jsonProperties>{"textTextarea":"&lt;p&gt;Hello world&lt;/p&gt;"}</jsonProperties>
    <odeComponentsOrder>1</odeComponentsOrder>
    <odeComponentsProperties>...</odeComponentsProperties>
  </odeComponent>
</odeComponents>
```

#### `<odeComponent>` child elements

| Element | Description |
|---------|-------------|
| `<odePageId>` | ID of the containing page |
| `<odeBlockId>` | ID of the containing block |
| `<odeIdeviceId>` | Unique iDevice identifier |
| `<odeIdeviceTypeName>` | iDevice type string (see Common iDevice Types) |
| `<htmlView>` | Pre-rendered HTML (HTML-escaped) |
| `<jsonProperties>` | iDevice configuration JSON (HTML-escaped) |
| `<odeComponentsOrder>` | Sort order within the block |
| `<odeComponentsProperties>` | Component-level properties |

#### Component Properties (`<odeComponentsProperty>`)

| Key | Type | Description |
|-----|------|-------------|
| `visibility` | boolean | Whether the iDevice is visible |
| `teacherOnly` | boolean | Restrict iDevice to teacher view |
| `identifier` | string | Optional CSS `id` attribute |
| `cssClass` | string | Optional extra CSS class(es) |

---

## Annotated Example

A minimal `content.xml` with one root page, one block, and one `text` iDevice:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">

  <!-- Theme selection -->
  <userPreferences>
    <userPreference>
      <key>theme</key>
      <value>base</value>
    </userPreference>
  </userPreferences>

  <!-- Project identifiers and version info -->
  <odeResources>
    <odeResource>
      <key>odeId</key>
      <value>20251125215855LURLBW</value>
    </odeResource>
    <odeResource>
      <key>odeVersionId</key>
      <value>20251125220103ABCXYZ</value>
    </odeResource>
    <odeResource>
      <key>eXeVersion</key>
      <value>v3.0.0</value>
    </odeResource>
  </odeResources>

  <!-- Document metadata -->
  <odeProperties>
    <odeProperty>
      <key>pp_title</key>
      <value>My Learning Content</value>
    </odeProperty>
    <odeProperty>
      <key>pp_author</key>
      <value>Jane Doe</value>
    </odeProperty>
    <odeProperty>
      <key>pp_lang</key>
      <value>en</value>
    </odeProperty>
    <odeProperty>
      <key>license</key>
      <value>creative commons: attribution - share alike 4.0</value>
    </odeProperty>
    <odeProperty>
      <key>pp_addExeLink</key>
      <value>true</value>
    </odeProperty>
    <odeProperty>
      <key>pp_addPagination</key>
      <value>false</value>
    </odeProperty>
  </odeProperties>

  <!-- Pages (flat list; parent-child via odeParentPageId) -->
  <odeNavStructures>

    <!-- Root page -->
    <odeNavStructure>
      <odePageId>20251125215855PAGE01</odePageId>
      <odeParentPageId/>       <!-- empty = root level -->
      <pageName>Introduction</pageName>
      <odeNavStructureOrder>1</odeNavStructureOrder>

      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key>
          <value>Introduction</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>visibility</key>
          <value>true</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>hidePageTitle</key>
          <value>false</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>

      <!-- Blocks within the page -->
      <odePagStructures>
        <odePagStructure>
          <odePageId>20251125215855PAGE01</odePageId>
          <odeBlockId>20251125215855BLK001</odeBlockId>
          <blockName>Text</blockName>
          <iconName/>
          <odePagStructureOrder>1</odePagStructureOrder>

          <odePagStructureProperties>
            <odePagStructureProperty>
              <key>visibility</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>teacherOnly</key>
              <value>false</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>allowToggle</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>minimized</key>
              <value>false</value>
            </odePagStructureProperty>
          </odePagStructureProperties>

          <!-- iDevice components within the block -->
          <odeComponents>
            <odeComponent>
              <odePageId>20251125215855PAGE01</odePageId>
              <odeBlockId>20251125215855BLK001</odeBlockId>
              <odeIdeviceId>20251125215855IDEV01</odeIdeviceId>
              <odeIdeviceTypeName>text</odeIdeviceTypeName>

              <!-- Pre-rendered HTML (HTML-escaped) -->
              <htmlView>&lt;div class="exe-text-template"&gt;&lt;p&gt;Hello world&lt;/p&gt;&lt;/div&gt;</htmlView>

              <!-- iDevice configuration JSON (HTML-escaped) -->
              <jsonProperties>{"textTextarea":"&lt;p&gt;Hello world&lt;/p&gt;"}</jsonProperties>

              <odeComponentsOrder>1</odeComponentsOrder>

              <odeComponentsProperties>
                <odeComponentsProperty>
                  <key>visibility</key>
                  <value>true</value>
                </odeComponentsProperty>
                <odeComponentsProperty>
                  <key>teacherOnly</key>
                  <value>false</value>
                </odeComponentsProperty>
              </odeComponentsProperties>
            </odeComponent>
          </odeComponents>

        </odePagStructure>
      </odePagStructures>
    </odeNavStructure>

    <!-- Child page (parent = PAGE01) -->
    <odeNavStructure>
      <odePageId>20251125215855PAGE02</odePageId>
      <odeParentPageId>20251125215855PAGE01</odeParentPageId>
      <pageName>Section 1.1</pageName>
      <odeNavStructureOrder>1</odeNavStructureOrder>
      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key>
          <value>Section 1.1</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>visibility</key>
          <value>true</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>
      <odePagStructures/>
    </odeNavStructure>

  </odeNavStructures>
</ode>
```

---

## Screenshot / Thumbnail

Since eXeLearning v4.0, `.elpx` files may include an optional `screenshot.png` at the archive root. This file serves as a project thumbnail/preview image that external systems (LMS platforms, file managers, repositories) can extract and display without processing the full package.

**File:** `screenshot.png` (root of ZIP archive)
**Format:** PNG
**Max dimensions:** 1280×720 pixels
**Source:** User-defined via Project Properties → Screenshot tab, or absent if not set

### Behavior

- **Export:** If the project has a screenshot set in its metadata, `ElpxExporter` writes it as `screenshot.png` at the archive root. If no screenshot is set, the file is omitted.
- **Import:** `ElpxImporter` reads `screenshot.png` from the archive root (if present) and stores it in the Yjs metadata as a base64 data URL under the `screenshot` key.
- **Backward compatibility:** Old `.elpx` files without `screenshot.png` import correctly — the screenshot metadata key is simply absent.
- **Collaborative editing:** The screenshot is stored in the Yjs `metadata` Y.Map and is synchronized across collaborators like any other project metadata field.

### Yjs Metadata Key

| Key | Type | Description |
|-----|------|-------------|
| `screenshot` | string (base64 data URL) | Project thumbnail PNG as `data:image/png;base64,...` |

---

## Asset References

Project assets (images, PDFs, audio, video) are stored in the ZIP under `content/resources/`. In `content.xml`, they are referenced using the `{{context_path}}` placeholder:

```html
<img src="{{context_path}}/content/resources/photo.jpg" alt="Photo">
```

At export time, `{{context_path}}` is replaced by the relative path from the HTML page to the root of the ZIP. At import time, `ElpxImporter` converts these references back to internal `asset://` URLs for use in the Yjs document.

---

## Common iDevice Types

The `<odeIdeviceTypeName>` value identifies the iDevice type. Common type strings:

| Type name | Description |
|-----------|-------------|
| `text` | Rich text / free text content |
| `form` | Data collection form |
| `matching` | Matching activity |
| `sort` | Ordering activity |
| `classify` | Classification activity |
| `guess` | Guess the word activity |
| `checklist` | Checklist activity |
| `crossword` | Crossword puzzle |
| `image-gallery` | Image gallery |
| `magnifier` | Image magnifier |
| `casestudy` | Case study |
| `external-website` | Embedded external website |
| `rubric` | Assessment rubric |
| `trueorfalse` | True or false questions |
| `quick-questions` | Quick quiz |
| `quick-questions-multiple-choice` | Multiple choice quiz |
| `complete` | Fill in the blanks |
| `download-source-file` | Download project source iDevice |

---

## Implementation Files

| File | Role |
|------|------|
| `src/shared/export/exporters/ElpxExporter.ts` | Builds the ZIP archive (extends `Html5Exporter`) |
| `src/shared/export/generators/OdeXmlGenerator.ts` | Generates `content.xml` from `ExportMetadata` + pages |
| `src/shared/import/ElpxImporter.ts` | Parses `.elpx` and `.elp` files into a Yjs document |
| `public/app/schemas/ode/content.dtd` | Formal DTD for the ODE 2.0 format |

---

## Differences from Legacy .elp

For full documentation of the legacy format, see [contentv3-format.md](contentv3-format.md).

| Aspect | `.elpx` (modern) | `.elp` (legacy) |
|--------|------------------|-----------------|
| Content file | `content.xml` (ODE 2.0) | `contentv3.xml` (Python pickle XML) |
| Root element | `<ode xmlns="...">` | `<instance class="exe.engine.package.Package">` |
| Serialization | Native XML | Python object serialization |
| Hierarchy | Flat list with `odeParentPageId` | Nested `Node` instances |
| Content storage | `<htmlView>`, `<jsonProperties>` | `<unicode content="true">` |
| Metadata | `<odeProperty>` elements | Dictionary key-value pairs |
| IDs | `YYYYMMDDHHmmss` + 6 chars | Sequential integers |
| DTD validation | Supported (`content.dtd`) | Not feasible (dynamic structure) |
| Asset paths | `{{context_path}}/content/resources/` | `resources/` |
| HTML output | Included in ZIP | Not included |
