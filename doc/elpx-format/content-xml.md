# `content.xml` Reference

Authoritative reference for the ODE 2.0 XML document that lives at the root of every `.elpx` archive. This is the file an importer reads to reconstruct a project.

> **Hub**: [doc/elpx-format.md](../elpx-format.md). Sibling subdocs:
> [container.md](container.md), [ids.md](ids.md), [metadata.md](metadata.md),
> [pages-blocks.md](pages-blocks.md), [idevices/catalog.md](idevices/catalog.md),
> [idevices/patterns.md](idevices/patterns.md), [validation.md](validation.md).

---

## At a glance

| Property | Value |
|----------|-------|
| Filename | `content.xml` (always at ZIP root) |
| Encoding | UTF-8, XML 1.0 |
| Namespace | `http://www.intef.es/xsd/ode` |
| Format version | ODE `2.0` (root attribute `version="2.0"`) |
| Schema | DTD `content.dtd` bundled at ZIP root + XSD `ode-content.xsd` (in repo, not bundled) |
| Top-level elements (in order) | `userPreferences?`, `odeResources?`, `odeProperties?`, `odeNavStructures` |
| Generator | [`src/shared/export/generators/OdeXmlGenerator.ts`](../../src/shared/export/generators/OdeXmlGenerator.ts) |
| Importer | [`src/shared/import/ElpxImporter.ts`](../../src/shared/import/ElpxImporter.ts) + [`src/services/xml/xml-parser.ts`](../../src/services/xml/xml-parser.ts) |

---

## Document declaration

Every `content.xml` produced by [`OdeXmlGenerator.generateOdeXml()`](../../src/shared/export/generators/OdeXmlGenerator.ts) starts with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
  ...
</ode>
```

Notes:

- The DOCTYPE filename is the constant `ODE_DTD_FILENAME` (= `"content.dtd"`) defined in [`src/shared/export/constants.ts:995`](../../src/shared/export/constants.ts).
- The DOCTYPE line is omitted only when the same generator is reused for SCORM/IMS exports (option `includeDoctype: false`). For `.elpx` it is always emitted.
- The XML declaration encoding is fixed to `UTF-8`. All text content (page titles, iDevice content, metadata) is UTF-8.
- `xmlns` is fixed by the DTD (`<!ATTLIST ode xmlns CDATA #FIXED "http://www.intef.es/xsd/ode">`); a parser that does not see this exact namespace MUST reject the file.
- `version` is currently `"2.0"`. The string `"3.0"` is the eXeLearning runtime version and lives separately inside `<odeResources>` under the key `exe_version`.

---

## Root `<ode>` element

```dtd
<!ELEMENT ode (userPreferences?, odeResources?, odeProperties?, odeNavStructures)>
<!ATTLIST ode
    xmlns CDATA #FIXED "http://www.intef.es/xsd/ode"
    version CDATA #IMPLIED>
```

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `xmlns` | Fixed | CDATA | Always `http://www.intef.es/xsd/ode` |
| `version` | Optional | CDATA | ODE format version. Currently `"2.0"`. Reserved for future schema bumps. |

Children in declared order:

| Child | Cardinality | Purpose | Subdoc |
|-------|-------------|---------|--------|
| `<userPreferences>` | 0 or 1 | UI-level preferences. Only `theme` is currently emitted. | [metadata.md#userpreferences](metadata.md) |
| `<odeResources>` | 0 or 1 | Package identifiers and runtime version. | [metadata.md#oderesources](metadata.md) |
| `<odeProperties>` | 0 or 1 | Project metadata (`pp_*` keys). | [metadata.md#odeproperties](metadata.md) |
| `<odeNavStructures>` | exactly 1 | Pages, blocks, components (the actual content tree). | [pages-blocks.md](pages-blocks.md) |

Although the DTD allows `userPreferences`, `odeResources`, `odeProperties` to be absent, the modern generator always emits all four. Importers should tolerate absence and fill with defaults from [`metadata-properties.ts`](../../src/shared/export/metadata-properties.ts).

---

## `<userPreferences>` and `<userPreference>`

Stores UI-level preferences. Currently only the active theme is emitted by the generator at [`OdeXmlGenerator.ts:79`](../../src/shared/export/generators/OdeXmlGenerator.ts):

```xml
<userPreferences>
  <userPreference>
    <key>theme</key>
    <value>base</value>
  </userPreference>
</userPreferences>
```

| Element | Children | Notes |
|---------|----------|-------|
| `<userPreferences>` | `<userPreference>*` | May be empty. |
| `<userPreference>` | `<key>` + `<value>` | Both `#PCDATA`, XML-escaped. |

Recognized keys (currently single):

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `theme` | string | `"base"` | Theme folder name. Must match a folder in `theme/` of the same `.elpx`, or be the name of a built-in theme that the runtime can load. See [themes.md](themes.md). |

The fallback `"base"` is hardcoded in the generator (`meta.theme || 'base'`).

---

## `<odeResources>` and `<odeResource>`

Package-level identifiers and runtime version. Generator at [`OdeXmlGenerator.ts:97`](../../src/shared/export/generators/OdeXmlGenerator.ts):

```xml
<odeResources>
  <odeResource>
    <key>odeId</key>
    <value>20251217061325EKESBR</value>
  </odeResource>
  <odeResource>
    <key>odeVersionId</key>
    <value>20251217061452XKBQML</value>
  </odeResource>
  <odeResource>
    <key>exe_version</key>
    <value>3.0</value>
  </odeResource>
</odeResources>
```

| Key | Type | Lifecycle | Description |
|-----|------|-----------|-------------|
| `odeId` | ODE identifier | Stable per project | Persistent project ID. Set once on creation; survives re-saves and re-exports. |
| `odeVersionId` | ODE identifier | Regenerated every export | Snapshot ID. Changes on every save/export; lets two `.elpx` files of the same project be distinguished. |
| `exe_version` | string | Constant per build | The running eXeLearning runtime version. Constant `ODE_VERSION` = `"3.0"` (see [`constants.ts:1000`](../../src/shared/export/constants.ts)). |

ID format and synchronization rules: see [ids.md](ids.md). Other resource keys observed in older fixtures (e.g. `odeVersionName`, `isDownload`, `eXeVersion`) are tolerated by the importer but **not produced** by the modern generator.

---

## `<odeProperties>` and `<odeProperty>`

Project metadata. Each `<odeProperty>` is a `<key>` / `<value>` pair (both `#PCDATA`, XML-escaped). The generator iterates [`METADATA_PROPERTIES`](../../src/shared/export/metadata-properties.ts) and emits one `<odeProperty>` per non-internal entry that has a non-empty value.

```xml
<odeProperties>
  <odeProperty>
    <key>pp_title</key>
    <value>An Introduction to Photosynthesis</value>
  </odeProperty>
  <odeProperty>
    <key>pp_lang</key>
    <value>en</value>
  </odeProperty>
  <odeProperty>
    <key>pp_addExeLink</key>
    <value>true</value>
  </odeProperty>
  ...
</odeProperties>
```

Boolean values are serialized as the strings `"true"` / `"false"` ([`valueToXmlString`, `metadata-properties.ts:354`](../../src/shared/export/metadata-properties.ts)). HTML/XML payloads (e.g. `pp_extraHeadContent`, `footer`) are XML-escaped via the standard entities — they are NOT wrapped in CDATA inside `<odeProperty>` (CDATA wrapping is reserved for `<htmlView>` and `<jsonProperties>`).

For the full key reference (internal key, XML key, type, default), see [metadata.md](metadata.md). The XSD enumerates the canonical keys at [`ode-content.xsd:255-291`](../../public/app/schemas/ode/ode-content.xsd) (`propertyKeyType`).

---

## `<odeNavStructures>` and the page/block/component tree

The body of the document. A flat list of `<odeNavStructure>` (page) elements, each containing blocks and components. Hierarchy between pages is expressed by `<odeParentPageId>`, **not** by XML nesting.

```dtd
<!ELEMENT odeNavStructures (odeNavStructure*)>
<!ELEMENT odeNavStructure (odePageId, odeParentPageId, pageName, odeNavStructureOrder, odeNavStructureProperties?, odePagStructures?)>
<!ELEMENT odePagStructures (odePagStructure*)>
<!ELEMENT odePagStructure (odePageId, odeBlockId, blockName, iconName?, odePagStructureOrder, odePagStructureProperties?, odeComponents?)>
<!ELEMENT odeComponents (odeComponent*)>
<!ELEMENT odeComponent (odePageId, odeBlockId, odeIdeviceId, odeIdeviceTypeName, htmlView?, jsonProperties?, odeComponentsOrder, odeComponentsProperties?)>
```

The full structural reference is in [pages-blocks.md](pages-blocks.md). This section gives the element-by-element schema.

### `<odeNavStructure>` — a page

```xml
<odeNavStructure>
  <odePageId>20251217062007PAGE01</odePageId>
  <odeParentPageId/>                    <!-- empty = root level -->
  <pageName>Introduction</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odeNavStructureProperties>...</odeNavStructureProperties>
  <odePagStructures>...</odePagStructures>
</odeNavStructure>
```

| Element | Cardinality | Type | Description |
|---------|-------------|------|-------------|
| `<odePageId>` | 1 | ODE identifier | Unique per page. See [ids.md](ids.md). |
| `<odeParentPageId>` | 1 | ODE identifier or empty | `<odeParentPageId/>` (empty) for root pages; otherwise the `odePageId` of the parent page. |
| `<pageName>` | 1 | string | Display name in navigation. Defaults to `"Page"` when missing. XML-escaped. |
| `<odeNavStructureOrder>` | 1 | integer | Sort key among siblings (0-based in modern generator). |
| `<odeNavStructureProperties>` | 0 or 1 | container | Page-level key/value properties. |
| `<odePagStructures>` | 0 or 1 | container | Blocks contained in the page. |

### `<odeNavStructureProperty>` — page-level property

`<key>` + `<value>` pair. The generator always emits `titlePage` ([`OdeXmlGenerator.ts:166`](../../src/shared/export/generators/OdeXmlGenerator.ts)) and may emit any extra keys that the editor stored on the page object.

| Key | Type | Description |
|-----|------|-------------|
| `titlePage` | string | Heading rendered above the page content (often equal to `<pageName>`). |
| `titleNode` | string | Navigation label override. |
| `titleHtml` | string (HTML) | Custom HTML title. |
| `hidePageTitle` | boolean | If `"true"`, suppress the rendered `<h1>`. |
| `editableInPage` | boolean | Allow inline page-title editing (editor only). |
| `visibility` | boolean | Hide the page in navigation when `"false"`. |
| `highlight` | boolean | Mark the page as highlighted in navigation. |
| `description` | string | Short description shown in tooltips and indices. |

### `<odePagStructure>` — a block (container of components)

```xml
<odePagStructure>
  <odePageId>20251217062007PAGE01</odePageId>      <!-- redundant but DTD-required -->
  <odeBlockId>20251217062007BLK001</odeBlockId>
  <blockName>Text</blockName>
  <iconName/>
  <odePagStructureOrder>0</odePagStructureOrder>
  <odePagStructureProperties>...</odePagStructureProperties>
  <odeComponents>...</odeComponents>
</odePagStructure>
```

| Element | Cardinality | Type | Description |
|---------|-------------|------|-------------|
| `<odePageId>` | 1 | ODE identifier | Echoes the enclosing page ID. **Must** match the parent `<odeNavStructure>`'s `<odePageId>`. |
| `<odeBlockId>` | 1 | ODE identifier | Unique per block. |
| `<blockName>` | 1 | string | Human label for the block. May be empty. |
| `<iconName>` | 0 or 1 | string | Optional theme icon name. The generator emits `<iconName/>` when absent. |
| `<odePagStructureOrder>` | 1 | integer | Sort key among sibling blocks (0-based). |
| `<odePagStructureProperties>` | 0 or 1 | container | Block-level properties. |
| `<odeComponents>` | 0 or 1 | container | iDevice components in this block. |

Block-level properties emitted by the generator ([`OdeXmlGenerator.ts:213`](../../src/shared/export/generators/OdeXmlGenerator.ts)):

| Key | Type | Description |
|-----|------|-------------|
| `visibility` | boolean | Whether the block is rendered. |
| `teacherOnly` | boolean | Restrict the block to teacher view. |
| `allowToggle` | boolean | Whether users can collapse/expand the block. |
| `minimized` | boolean | Whether the block starts collapsed. |
| `cssClass` | string | Extra CSS class(es) applied to the block container. |

The legacy property `identifier` (custom HTML `id`) is tolerated on import but no longer emitted.

### `<odeComponent>` — an iDevice instance

```xml
<odeComponent>
  <odePageId>20251217062007PAGE01</odePageId>     <!-- redundant; must match enclosing page -->
  <odeBlockId>20251217062007BLK001</odeBlockId>   <!-- redundant; must match enclosing block -->
  <odeIdeviceId>20251217062007IDEV1</odeIdeviceId>
  <odeIdeviceTypeName>text</odeIdeviceTypeName>
  <htmlView><![CDATA[<div class="exe-text-template">...</div>]]></htmlView>
  <jsonProperties><![CDATA[{"textTextarea":"...","ideviceId":"..."}]]></jsonProperties>
  <odeComponentsOrder>0</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty>
      <key>visibility</key>
      <value>true</value>
    </odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

| Element | Cardinality | Type | Description |
|---------|-------------|------|-------------|
| `<odePageId>` | 1 | ODE identifier | Echoes the enclosing page ID. Must match. |
| `<odeBlockId>` | 1 | ODE identifier | Echoes the enclosing block ID. Must match. |
| `<odeIdeviceId>` | 1 | ODE identifier | Unique per component. |
| `<odeIdeviceTypeName>` | 1 | string (enum) | iDevice type. See [idevices/catalog.md](idevices/catalog.md) for the full list. Legacy CamelCase names are accepted on import and remapped via [`IDEVICE_TYPE_MAP`](../../src/shared/export/constants.ts) at `constants.ts:843`. |
| `<htmlView>` | 0 or 1 | CDATA-wrapped HTML | Pre-rendered HTML for export. See [CDATA rules](#cdata-and-escaping-rules) below. |
| `<jsonProperties>` | 0 or 1 | CDATA-wrapped JSON | Editable state for re-import. See [idevices/patterns.md](idevices/patterns.md) for the four storage patterns. |
| `<odeComponentsOrder>` | 1 | integer | Sort key among siblings (0-based). |
| `<odeComponentsProperties>` | 0 or 1 | container | Component-level properties. |

Component-level properties emitted by the generator ([`OdeXmlGenerator.ts:285`](../../src/shared/export/generators/OdeXmlGenerator.ts)):

| Key | Type | Description |
|-----|------|-------------|
| `visibility` | boolean | Whether the component renders. Always emitted; defaults to `"true"`. |
| `teacherOnly` | boolean | Restrict to teacher view. |
| `cssClass` | string | Extra CSS class(es) applied to the component container. |

> **DTD requirement**: although `<odeComponentsProperties>` is marked optional in the DTD, the generator always emits it (with at least `visibility=true` when no other properties are present). When generating `.elpx` programmatically, emit an empty `<odeComponentsProperties></odeComponentsProperties>` rather than omitting the element — many third-party validators expect it.

---

## CDATA and escaping rules

### Rule 1 — `<htmlView>` and `<jsonProperties>` are ALWAYS CDATA-wrapped

Every emitted `<htmlView>` and `<jsonProperties>` element has its content wrapped in `<![CDATA[ ... ]]>` ([`OdeXmlGenerator.ts:270, 275`](../../src/shared/export/generators/OdeXmlGenerator.ts)). This applies even when the content does not contain any XML-significant characters. Examples:

```xml
<htmlView><![CDATA[<p>Hello world</p>]]></htmlView>
<jsonProperties><![CDATA[{"textTextarea":"<p>Hello world</p>","ideviceId":"20251217062007IDEV1"}]]></jsonProperties>
```

### Rule 2 — `]]>` inside CDATA must be split

CDATA cannot contain the literal sequence `]]>` because it terminates the section. The exporter handles this with [`escapeCdata` (`OdeXmlGenerator.ts:352`](../../src/shared/export/generators/OdeXmlGenerator.ts)):

```js
str.replace(/\]\]>/g, ']]]]><![CDATA[>');
```

When generating `.elpx` by hand or with an LLM, apply the same transform. A paragraph containing the literal text `the operator ]]>` becomes:

```xml
<htmlView><![CDATA[<p>the operator ]]]]><![CDATA[> is rare</p>]]></htmlView>
```

(That is two adjacent CDATA sections; XML parsers concatenate them transparently.)

### Rule 3 — XML attribute and text escaping elsewhere

For all other text nodes (page names, property values, block names, etc.), the generator uses [`escapeXml` (`OdeXmlGenerator.ts:337`](../../src/shared/export/generators/OdeXmlGenerator.ts)):

| Input character | Replaced with |
|-----------------|---------------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&apos;` |

Empty / null / undefined values become an empty string.

### Rule 4 — UTF-8 throughout

No BOM, no UTF-16. Non-ASCII characters appear directly in their UTF-8 bytes. Numeric character references are not used.

---

## DTD (bundled inside every `.elpx`)

The DTD is bundled at the ZIP root as `content.dtd`. It is generated from the constant [`ODE_DTD_CONTENT` in `src/shared/export/constants.ts:1006`](../../src/shared/export/constants.ts):

```dtd
<!--
    ODE Content DTD
    Document Type Definition for eXeLearning ODE XML format (content.xml)
    Version: 2.0
    Namespace: http://www.intef.es/xsd/ode
    Copyright (C) 2025 eXeLearning - License: AGPL-3.0
-->

<!ELEMENT ode (userPreferences?, odeResources?, odeProperties?, odeNavStructures)>
<!ATTLIST ode
    xmlns CDATA #FIXED "http://www.intef.es/xsd/ode"
    version CDATA #IMPLIED>

<!-- User Preferences -->
<!ELEMENT userPreferences (userPreference*)>
<!ELEMENT userPreference (key, value)>

<!-- ODE Resources -->
<!ELEMENT odeResources (odeResource*)>
<!ELEMENT odeResource (key, value)>

<!-- ODE Properties -->
<!ELEMENT odeProperties (odeProperty*)>
<!ELEMENT odeProperty (key, value)>

<!-- Shared Key-Value Elements -->
<!ELEMENT key (#PCDATA)>
<!ELEMENT value (#PCDATA)>

<!-- Navigation Structures (Pages) -->
<!ELEMENT odeNavStructures (odeNavStructure*)>
<!ELEMENT odeNavStructure (odePageId, odeParentPageId, pageName, odeNavStructureOrder, odeNavStructureProperties?, odePagStructures?)>

<!ELEMENT odePageId (#PCDATA)>
<!ELEMENT odeParentPageId (#PCDATA)>
<!ELEMENT pageName (#PCDATA)>
<!ELEMENT odeNavStructureOrder (#PCDATA)>

<!ELEMENT odeNavStructureProperties (odeNavStructureProperty*)>
<!ELEMENT odeNavStructureProperty (key, value)>

<!-- Block Structures -->
<!ELEMENT odePagStructures (odePagStructure*)>
<!ELEMENT odePagStructure (odePageId, odeBlockId, blockName, iconName?, odePagStructureOrder, odePagStructureProperties?, odeComponents?)>

<!ELEMENT odeBlockId (#PCDATA)>
<!ELEMENT blockName (#PCDATA)>
<!ELEMENT iconName (#PCDATA)>
<!ELEMENT odePagStructureOrder (#PCDATA)>

<!ELEMENT odePagStructureProperties (odePagStructureProperty*)>
<!ELEMENT odePagStructureProperty (key, value)>

<!-- Components (iDevices) -->
<!ELEMENT odeComponents (odeComponent*)>
<!ELEMENT odeComponent (odePageId, odeBlockId, odeIdeviceId, odeIdeviceTypeName, htmlView?, jsonProperties?, odeComponentsOrder, odeComponentsProperties?)>

<!ELEMENT odeIdeviceId (#PCDATA)>
<!ELEMENT odeIdeviceTypeName (#PCDATA)>
<!ELEMENT htmlView (#PCDATA)>
<!ELEMENT jsonProperties (#PCDATA)>
<!ELEMENT odeComponentsOrder (#PCDATA)>

<!ELEMENT odeComponentsProperties (odeComponentsProperty*)>
<!ELEMENT odeComponentsProperty (key, value)>
```

A canonical, more heavily commented version of the same DTD lives in the repository at [`public/app/schemas/ode/content.dtd`](../../public/app/schemas/ode/content.dtd). The two are equivalent in element structure; only the comments differ.

---

## XSD (companion schema, not bundled)

A stricter XML Schema is available at [`public/app/schemas/ode/ode-content.xsd`](../../public/app/schemas/ode/ode-content.xsd). Use it when you need stronger validation than the DTD provides.

### What the XSD adds beyond the DTD

| Feature | XSD constraint | DTD equivalent |
|---------|----------------|----------------|
| Identifier format | `xs:pattern value="[0-9]{14}[A-Z0-9]{6}\|page-[a-z0-9-]+\|[a-zA-Z0-9_-]+"` on `odeIdentifierType` | None — `#PCDATA` |
| iDevice type list | `xs:enumeration` of every modern + legacy/FPD type name (`ideviceTypeType`) | None — `#PCDATA` |
| Property key list | `xs:enumeration` of recognized `pp_*` keys (`propertyKeyType`) | None — `#PCDATA` |
| Boolean strings | `xs:enumeration` `"true"`, `"false"`, `"True"`, `"False"` (`booleanStringType`) | None |
| Order numbers | `xs:integer` for `*Order` elements | `#PCDATA` |
| Required `odeNavStructure` | `minOccurs="1"` | None — DTD allows zero |

The XSD is intentionally not bundled inside `.elpx` because (a) DTDs are still the de-facto standard that many lightweight validators understand, and (b) keeping the bundled schema small saves bytes.

### Validating with the XSD

```bash
xmllint --noout --schema public/app/schemas/ode/ode-content.xsd path/to/content.xml
```

See [validation.md](validation.md) for the full validation playbook.

---

## Cardinality and ordering summary

A compact reference for code generators:

```
ode
├── userPreferences?         (0..1)
│     └── userPreference*
│            ├── key
│            └── value
├── odeResources?            (0..1)
│     └── odeResource*
│            ├── key
│            └── value
├── odeProperties?           (0..1)
│     └── odeProperty*
│            ├── key
│            └── value
└── odeNavStructures         (1..1)   <-- the only required top-level child
      └── odeNavStructure*
             ├── odePageId            (1)
             ├── odeParentPageId      (1)        <!-- empty for root pages -->
             ├── pageName             (1)
             ├── odeNavStructureOrder (1)
             ├── odeNavStructureProperties?
             │     └── odeNavStructureProperty*
             │            ├── key
             │            └── value
             └── odePagStructures?
                   └── odePagStructure*
                          ├── odePageId             (1)        <!-- redundant -->
                          ├── odeBlockId            (1)
                          ├── blockName             (1)
                          ├── iconName?             (0..1)
                          ├── odePagStructureOrder  (1)
                          ├── odePagStructureProperties?
                          │     └── odePagStructureProperty*
                          │            ├── key
                          │            └── value
                          └── odeComponents?
                                └── odeComponent*
                                       ├── odePageId             (1)
                                       ├── odeBlockId            (1)
                                       ├── odeIdeviceId          (1)
                                       ├── odeIdeviceTypeName    (1)
                                       ├── htmlView?             (0..1)  CDATA-wrapped
                                       ├── jsonProperties?       (0..1)  CDATA-wrapped
                                       ├── odeComponentsOrder    (1)
                                       └── odeComponentsProperties?
                                             └── odeComponentsProperty*
                                                    ├── key
                                                    └── value
```

Element order is **strict**: a parser MUST reject an `<odeComponent>` whose `<htmlView>` appears after its `<odeComponentsOrder>`, or an `<odeNavStructure>` that places `<pageName>` before `<odeParentPageId>`.

---

## Common gotchas

1. **Redundant IDs must be in lockstep.** `<odePageId>` and `<odeBlockId>` appear at every nesting level (page, block, component). All three references inside an `<odeComponent>` MUST agree with the IDs of the enclosing `<odePagStructure>` and `<odeNavStructure>`. Mismatches make the importer reject the component or attach it to the wrong block.
2. **Boolean strings only.** Properties typed as boolean in [`metadata-properties.ts`](../../src/shared/export/metadata-properties.ts) are emitted as the literal strings `"true"` / `"false"`. Do not use `1`/`0`, `True`/`False`, or `yes`/`no`. The XSD `booleanStringType` is permissive on capitalization, but the importer's `parsePropertyValue` (`metadata-properties.ts:333`) only checks `toLowerCase() === 'true'`.
3. **Always emit `<odeComponentsProperties>` even when empty.** The DTD marks it optional, but every reference fixture and the generator always emit it (with at least `visibility=true`). Some third-party tools assume its presence.
4. **CDATA wrappers are unconditional** for `<htmlView>` and `<jsonProperties>`. Do not "optimize" by emitting raw HTML-escaped content — the importer's regex-based extractors expect CDATA delimiters.
5. **Page hierarchy is flat in XML.** Nesting one `<odeNavStructure>` inside another's `<odePagStructures>` is invalid. Use `<odeParentPageId>` to express parent-child relationships.
6. **`exe_version`, not `eXeVersion`.** The XML key for the runtime version is `exe_version` (snake_case). The misspelling `eXeVersion` appears in some old fixtures; the importer accepts both, but the modern generator only writes `exe_version`.
7. **Asset references use `{{context_path}}`.** Inside `<htmlView>` and `<jsonProperties>`, asset URLs take the v4 form `{{context_path}}/<exportPath>` where `<exportPath>` is `<folderPath>/<filename>` for assets inside a user-created folder (e.g. `photos/vacation/sunset.jpg`) or just `<filename>` when no folder. The placeholder absorbs both the page-depth `../` prefix and the `content/resources/` segment. The legacy long form `{{context_path}}/content/resources/<exportPath>` is also accepted on import. The asset itself lives at `content/resources/<exportPath>` inside the ZIP — never inside a legacy v3 per-asset UUID subfolder (`[0-9]{14}[A-Z0-9]{6}`). The import pipeline rewrites either reference form to `asset://<uuid>`. See [assets.md](assets.md).

---

## See also

- [container.md](container.md) — every file inside an `.elpx` ZIP
- [ids.md](ids.md) — ODE identifier format, lifecycle, and synchronization rules
- [metadata.md](metadata.md) — full reference for `pp_*` keys, `userPreferences`, `odeResources`
- [pages-blocks.md](pages-blocks.md) — flat-list navigation model, internal `exe-node:` links
- [idevices/catalog.md](idevices/catalog.md) — every iDevice type
- [idevices/patterns.md](idevices/patterns.md) — the four content-storage patterns
- [validation.md](validation.md) — validating with `xmllint` and `OdeXmlValidator`
- [ai-generation.md](ai-generation.md) — rules for LLMs producing `.elpx`
- [examples/minimal-content-xml.md](examples/minimal-content-xml.md) — a complete, validating example
