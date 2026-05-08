# ELPX Pages and Blocks

This document describes the page/block/component hierarchy stored in `<odeNavStructures>`, the flat-list page model, block composition, the properties emitted at each level, and internal page links.

See also: [ELPX format overview](../elpx-format.md) | [Container](container.md) | [IDs](ids.md) | [Metadata](metadata.md)

---

## Flat-list page model

Pages are **not** nested in XML. Every `<odeNavStructure>` is a sibling inside `<odeNavStructures>`, regardless of its depth in the content tree. The tree structure is expressed entirely through `<odeParentPageId>`:

- Empty `<odeParentPageId/>` (or absent) — root-level page.
- A non-empty `<odeParentPageId>` — child of the page with that ID.

A consumer reconstructs the tree by building a parent-lookup map over all `<odeNavStructure>` elements and then sorting each sibling group by `<odeNavStructureOrder>`.

Example from the fix-simple fixture (`content.xml`):

```
Page 1       (odePageId=20251217062007DGJTXL, parent="", order=1)
  Page 1-1   (odePageId=20251217062007TAOLOT, parent=DGJTXL,  order=1)
    Page 1-1-1 (odePageId=20251217062007OYUHOO, parent=TAOLOT, order=1)
  Page 1-2   (odePageId=20251217062007PYMEIX, parent=DGJTXL,  order=2)
Page 2       (odePageId=20251217062007XIMGJI, parent="",      order=2)
  Page 2-1   (odePageId=20251217062007SGKHYG, parent=XIMGJI,  order=1)
```

All six `<odeNavStructure>` elements appear at the same XML depth.

---

## Sibling ordering

`<odeNavStructureOrder>` is an integer. The generator (`OdeXmlGenerator.ts:162`) writes:

```typescript
xml += `  <odeNavStructureOrder>${page.order ?? order}</odeNavStructureOrder>\n`;
```

where `order` is the loop index (0-based) used as a fallback when `page.order` is not set. Sibling pages share the same parent and are ordered contiguously starting at 1 in the fixture (or 0 in the generator's fallback). Pages with identical order values among siblings are undefined behaviour — always emit distinct, contiguous integers.

---

## Page-level element reference

| Element | Required (DTD) | Type | Description | Source |
|---|---|---|---|---|
| `<odePageId>` | Yes | `odeIdentifierType` | Unique page identifier | `OdeXmlGenerator.ts:159` |
| `<odeParentPageId>` | Yes | string (may be empty) | Parent page ID; empty string = root | `OdeXmlGenerator.ts:160` |
| `<pageName>` | Yes | string | Page title used in navigation | `OdeXmlGenerator.ts:161` |
| `<odeNavStructureOrder>` | Yes | integer | Sort order among siblings | `OdeXmlGenerator.ts:162` |
| `<odeNavStructureProperties>` | No | property list | Page-level key/value properties | `OdeXmlGenerator.ts:165–174` |
| `<odePagStructures>` | No | block list | Blocks contained in this page | `OdeXmlGenerator.ts:176–181` |

### Page-level properties (`<odeNavStructureProperty>`)

The generator always emits `titlePage` (`OdeXmlGenerator.ts:166`), then any additional entries in `page.properties`:

| Key | Type | Description |
|---|---|---|
| `titlePage` | string | Always emitted; the rendered page heading |
| `titleNode` | string | Navigation label (may differ from `pageName`) |
| `titleHtml` | string (HTML) | Custom HTML title override |
| `hidePageTitle` | boolean string | Hide the page `<h1>` heading |
| `editableInPage` | boolean string | Allow inline title editing |
| `visibility` | boolean string | Whether the page is visible in navigation |
| `highlight` | boolean string | Highlight this page in the navigation |
| `description` | string | Short description shown in navigation |

The `titlePage` property is always present because it is emitted unconditionally by the generator. All other keys appear only when `page.properties` contains them.

---

## Block model

Each page contains zero or more blocks (`<odePagStructure>` elements) inside `<odePagStructures>`. A block is a layout container that holds one or more iDevice components.

The block repeats the enclosing page's ID as its first child (`<odePageId>`). This is required by the DTD (`content.dtd:69`) and must equal the ID in the parent `<odeNavStructure>`.

### Block-level element reference

| Element | Required (DTD) | Type | Description | Source |
|---|---|---|---|---|
| `<odePageId>` | Yes | `odeIdentifierType` | ID of the containing page (redundant — must match parent) | `OdeXmlGenerator.ts:204` |
| `<odeBlockId>` | Yes | `odeIdentifierType` | Unique block identifier | `OdeXmlGenerator.ts:205` |
| `<blockName>` | Yes | string | Human-readable block label | `OdeXmlGenerator.ts:206` |
| `<iconName>` | No | string | Icon identifier for the block (may be empty) | `OdeXmlGenerator.ts:207` |
| `<odePagStructureOrder>` | Yes | integer | Sort order within the page | `OdeXmlGenerator.ts:208` |
| `<odePagStructureProperties>` | No | property list | Block-level properties | `OdeXmlGenerator.ts:211–220` |
| `<odeComponents>` | No | component list | iDevice components | `OdeXmlGenerator.ts:223–228` |

### Block-level properties (`<odePagStructureProperty>`)

The generator iterates a fixed key list (`OdeXmlGenerator.ts:213`) and emits only the keys that are present in `block.properties`:

| Key | Type | Description |
|---|---|---|
| `visibility` | boolean string | Whether the block is visible |
| `teacherOnly` | boolean string | Restrict block to teacher view |
| `allowToggle` | boolean string | Allow block to be collapsed/expanded |
| `minimized` | boolean string | Block starts in collapsed state |
| `cssClass` | string | Optional extra CSS class(es) |

The `identifier` key (`cssClass` sibling) is written by older exporters and appears in real content.xml files (see fix-simple fixture), but is not in the generator's fixed key list — it will be present when passed via `block.properties` directly.

---

## Component model

Each block contains zero or more `<odeComponent>` elements inside `<odeComponents>`. A component represents one iDevice instance.

Like the block, the component repeats both the page ID and the block ID as its first two children. These must match the enclosing block's values.

### Component-level element reference

| Element | Required (DTD) | Type | Description | Source |
|---|---|---|---|---|
| `<odePageId>` | Yes | `odeIdentifierType` | Enclosing page ID (must match parent block's `<odePageId>`) | `OdeXmlGenerator.ts:263` |
| `<odeBlockId>` | Yes | `odeIdentifierType` | Enclosing block ID (must match parent `<odeBlockId>`) | `OdeXmlGenerator.ts:264` |
| `<odeIdeviceId>` | Yes | `odeIdentifierType` | Unique iDevice identifier | `OdeXmlGenerator.ts:265` |
| `<odeIdeviceTypeName>` | Yes | `ideviceTypeType` (XSD enum) | iDevice type string | `OdeXmlGenerator.ts:266` |
| `<htmlView>` | No | CDATA string | Pre-rendered HTML content | `OdeXmlGenerator.ts:270` |
| `<jsonProperties>` | No | CDATA string | iDevice configuration as JSON | `OdeXmlGenerator.ts:273–278` |
| `<odeComponentsOrder>` | Yes | integer | Sort order within the block | `OdeXmlGenerator.ts:280` |
| `<odeComponentsProperties>` | No | property list | Component-level structure properties | `OdeXmlGenerator.ts:283–295` |

### CDATA wrapping

`OdeXmlGenerator` **always** wraps `<htmlView>` and `<jsonProperties>` content in `<![CDATA[ ... ]]>` sections (`OdeXmlGenerator.ts:270`, `OdeXmlGenerator.ts:275`):

```typescript
xml += `          <htmlView><![CDATA[${escapeCdata(htmlContent)}]]></htmlView>\n`;
// ...
xml += `          <jsonProperties><![CDATA[${escapeCdata(jsonStr)}]]></jsonProperties>\n`;
```

The `escapeCdata()` function (`OdeXmlGenerator.ts:352–356`) handles the only forbidden sequence inside a CDATA section (`]]>`) by splitting it into adjacent CDATA sections:

```typescript
return String(str).replace(/\]\]>/g, ']]]]><![CDATA[>');
```

Note: the `content.xml` produced by older eXeLearning versions (pre-v3.0 or certain builds) uses HTML-entity escaping (`&lt;`, `&gt;`) instead of CDATA for these fields — see the fix-simple fixture as evidence. The importer handles both encodings because XML parsers decode both transparently. The existing overview in `doc/elpx-format.md` incorrectly stated that CDATA is not used; the modern generator always uses it.

### Component-level properties (`<odeComponentsProperty>`)

The generator iterates a fixed key list (`OdeXmlGenerator.ts:285`) and emits only the keys present in `component.structureProperties`. When `structureProperties` is absent, `visibility: true` is emitted as a default (`OdeXmlGenerator.ts:293`):

| Key | Type | Description |
|---|---|---|
| `visibility` | boolean string | Whether the iDevice is visible |
| `teacherOnly` | boolean string | Restrict iDevice to teacher view |
| `cssClass` | string | Optional extra CSS class(es) |

---

## Internal page links

Links between pages within the same project use the `exe-node:` URI scheme:

```html
<a href="exe-node:20251125215855PAGE02">Section 2</a>
<a href="exe-node:20251125215855PAGE02#introduction">Section 2 intro</a>
```

These URIs are stored literally in `<htmlView>` and in JSON property values (e.g., `jsonProperties.textTextarea` for `text` iDevices). They are never resolved to actual HTML paths inside `content.xml`.

At **export time** (`BaseExporter.ts:840–870`), the exporter replaces `exe-node:<pageId>` with the relative HTML path to the corresponding page. For multi-page exports this is a path like `html/page-title.html`; for single-page exports it becomes a fragment anchor.

At **import time** (`ElpxImporter.ts:1453–1479`), after all page IDs have been reassigned, `remapInternalPageLinks()` rewrites every `exe-node:<oldId>` reference to `exe-node:<newId>` using the `idRemap` built during `buildFlatPageList()`. The rewrite covers both `htmlView` strings and recursively walks JSON property objects via `remapLinksInObject()`.

---

## Annotated example: 1 root page + 1 child page with a text iDevice

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">

  <userPreferences>
    <userPreference><key>theme</key><value>base</value></userPreference>
  </userPreferences>

  <odeResources>
    <odeResource><key>odeId</key><value>20260427120000PROJID</value></odeResource>
    <odeResource><key>odeVersionId</key><value>20260427120001VERSID</value></odeResource>
    <odeResource><key>exe_version</key><value>3.0</value></odeResource>
  </odeResources>

  <odeProperties>
    <odeProperty><key>pp_title</key><value>Example Project</value></odeProperty>
    <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
  </odeProperties>

  <!-- Flat list: all pages at the same XML depth -->
  <odeNavStructures>

    <!-- Root page (odeParentPageId is empty) -->
    <odeNavStructure>
      <odePageId>20260427120002PAGEA1</odePageId>
      <odeParentPageId/>
      <pageName>Introduction</pageName>
      <odeNavStructureOrder>0</odeNavStructureOrder>

      <odeNavStructureProperties>
        <!-- titlePage always emitted (OdeXmlGenerator.ts:166) -->
        <odeNavStructureProperty>
          <key>titlePage</key><value>Introduction</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>visibility</key><value>true</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>

      <odePagStructures>
        <odePagStructure>
          <!-- Redundant pageId: must equal enclosing odeNavStructure/odePageId -->
          <odePageId>20260427120002PAGEA1</odePageId>
          <odeBlockId>20260427120003BLKB1</odeBlockId>
          <blockName>Text</blockName>
          <iconName/>
          <odePagStructureOrder>0</odePagStructureOrder>

          <odePagStructureProperties>
            <!-- Fixed key list: visibility, teacherOnly, allowToggle, minimized, cssClass -->
            <odePagStructureProperty><key>visibility</key><value>true</value></odePagStructureProperty>
            <odePagStructureProperty><key>teacherOnly</key><value>false</value></odePagStructureProperty>
            <odePagStructureProperty><key>allowToggle</key><value>true</value></odePagStructureProperty>
            <odePagStructureProperty><key>minimized</key><value>false</value></odePagStructureProperty>
          </odePagStructureProperties>

          <odeComponents>
            <odeComponent>
              <!-- Both page and block IDs repeated; must match enclosing elements -->
              <odePageId>20260427120002PAGEA1</odePageId>
              <odeBlockId>20260427120003BLKB1</odeBlockId>
              <odeIdeviceId>20260427120004IDVC1</odeIdeviceId>
              <odeIdeviceTypeName>text</odeIdeviceTypeName>

              <!-- htmlView: always CDATA-wrapped by modern generator -->
              <htmlView><![CDATA[<div class="exe-text-template"><p>Hello world. <a href="exe-node:20260427120005PAGEB1">See section 2</a>.</p></div>]]></htmlView>

              <!-- jsonProperties: always CDATA-wrapped; link must also be updated on import -->
              <jsonProperties><![CDATA[{"textTextarea":"<p>Hello world. <a href=\"exe-node:20260427120005PAGEB1\">See section 2</a>.</p>"}]]></jsonProperties>

              <odeComponentsOrder>0</odeComponentsOrder>

              <odeComponentsProperties>
                <!-- Default when no structureProperties: visibility=true -->
                <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
              </odeComponentsProperties>
            </odeComponent>
          </odeComponents>
        </odePagStructure>
      </odePagStructures>
    </odeNavStructure>

    <!-- Child page: parent = Introduction -->
    <odeNavStructure>
      <odePageId>20260427120005PAGEB1</odePageId>
      <odeParentPageId>20260427120002PAGEA1</odeParentPageId>
      <pageName>Section 2</pageName>
      <odeNavStructureOrder>0</odeNavStructureOrder>

      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key><value>Section 2</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>visibility</key><value>true</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>

      <!-- Empty page: no blocks -->
      <odePagStructures/>
    </odeNavStructure>

  </odeNavStructures>
</ode>
```
