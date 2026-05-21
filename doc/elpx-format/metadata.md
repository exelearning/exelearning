# ELPX Metadata

This document describes the three top-level metadata containers in `content.xml` (`<userPreferences>`, `<odeResources>`, `<odeProperties>`), every property key they carry, serialization rules, and round-trip behaviour through the importer.

See also: [ELPX format overview](../elpx-format.md) | [Container](container.md) | [IDs](ids.md) | [Pages and blocks](pages-blocks.md)

---

## Overview

The `<ode>` root element contains three metadata containers before `<odeNavStructures>`. All three are optional in the DTD (`content.dtd:20`) but are always emitted by `OdeXmlGenerator`:

```xml
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
  <userPreferences> ... </userPreferences>
  <odeResources>    ... </odeResources>
  <odeProperties>   ... </odeProperties>
  <odeNavStructures> ... </odeNavStructures>
</ode>
```

---

## 1. `<userPreferences>`

Stores user-level configuration. Every entry is a `<userPreference>` with a `<key>` and `<value>` child.

The generator (`OdeXmlGenerator.ts:77–82`) emits exactly one entry:

```typescript
function generateUserPreferencesXml(meta: ExportMetadata): string {
    let xml = '<userPreferences>\n';
    xml += generateUserPreferenceEntry('theme', meta.theme || 'base');
    xml += '</userPreferences>\n';
    return xml;
}
```

| Key | Default | Description |
|---|---|---|
| `theme` | `'base'` | Active theme name. Matches the theme directory bundled in `theme/` inside the ZIP. |

No other keys are currently written to `<userPreferences>` by the generator. Additional keys may appear in files produced by older versions and should be preserved on round-trip.

```xml
<userPreferences>
  <userPreference>
    <key>theme</key>
    <value>base</value>
  </userPreference>
</userPreferences>
```

---

## 2. `<odeResources>`

Stores package-level identifiers and the generator version. Every entry is an `<odeResource>` with a `<key>` and `<value>` child.

The generator (`OdeXmlGenerator.ts:97–103`) emits exactly three entries:

```typescript
function generateOdeResourcesXml(odeId: string, versionId: string): string {
    let xml = '<odeResources>\n';
    xml += generateOdeResourceEntry('odeId', odeId);
    xml += generateOdeResourceEntry('odeVersionId', versionId);
    xml += generateOdeResourceEntry('exe_version', ODE_VERSION);
    xml += '</odeResources>\n';
    return xml;
}
```

`ODE_VERSION` is the constant `'3.0'` defined in `constants.ts:1000`.

| Key | Description |
|---|---|
| `odeId` | Stable project identifier. Retrieved from `meta.odeIdentifier` on export; generated once via `generateOdeId()` if absent. |
| `odeVersionId` | Stable per-version identifier. Read from `meta.odeVersionId` on export; generated once via `generateOdeId()` only when absent. Imported from `<odeResources>` so a round-trip without content changes preserves the value. |
| `exe_version` | The ODE format version string, currently `'3.0'` (constant `ODE_VERSION` from `constants.ts:1000`). |

**Legacy keys observed in older fixtures:** the v4 generator writes exactly three resources (`odeId`, `odeVersionId`, `exe_version`). Some older fixtures additionally carry `odeVersionName`, `isDownload`, or the misspelling `eXeVersion`. The importer accepts all of these for backward compatibility, but **`generateOdeResourcesXml()` never emits them in v4** — treat them as informational legacy keys when reading older `.elpx` files.

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
    <key>exe_version</key>
    <value>3.0</value>
  </odeResource>
</odeResources>
```

---

## 3. `<odeProperties>`

Stores document metadata. Every entry is an `<odeProperty>` with a `<key>` and `<value>` child. The generator iterates `Object.entries(meta)` and emits one entry per property that is not excluded, not empty, and not null/undefined (`OdeXmlGenerator.ts:121–138`).

The single source of truth for every property is `METADATA_PROPERTIES` in `metadata-properties.ts`.

### Full property table

| Internal key | XML key | Type | Default | Category | Description |
|---|---|---|---|---|---|
| `title` | `pp_title` | string | `'eXeLearning'` | core | Project title |
| `subtitle` | `pp_subtitle` | string | `''` | core | Project subtitle |
| `author` | `pp_author` | string | `''` | core | Author name |
| `description` | `pp_description` | string | `''` | core | Project description |
| `language` | `pp_lang` | string | `'en'` | core | Language code (BCP 47, e.g. `'en'`, `'es'`) |
| `license` | `pp_license` | string | `''` | core | License identifier (e.g. `'creative commons: attribution - share alike 4.0'`) |
| `licenseUrl` | `pp_licenseUrl` | string | `''` | core | License URL |
| `keywords` | `pp_keywords` | string | `''` | core | Comma-separated keywords |
| `category` | `pp_category` | string | `''` | core | Content category |
| `theme` | `pp_theme` | string | `'base'` | core | Theme name (also written to `<userPreferences>`) |
| `customStyles` | `pp_customStyles` | string | `''` | core | Custom CSS injected into all pages |
| `exelearningVersion` | `pp_exelearning_version` | string | `''` | core | eXeLearning application version string |
| `addExeLink` | `pp_addExeLink` | boolean | `true` | export | Include "Made with eXeLearning" footer link |
| `addPagination` | `pp_addPagination` | boolean | `false` | export | Add page navigation arrows |
| `addSearchBox` | `pp_addSearchBox` | boolean | `false` | export | Include search box |
| `addAccessibilityToolbar` | `pp_addAccessibilityToolbar` | boolean | `false` | export | Include accessibility toolbar |
| `addMathJax` | `pp_addMathJax` | boolean | `false` | export | Load MathJax for LaTeX rendering |
| `exportSource` | `exportSource` | boolean | `true` | export | Include editable source in export (no `pp_` prefix — legacy compatibility) |
| `globalFont` | `pp_globalFont` | string | `'default'` | export | Global font override |
| `extraHeadContent` | `pp_extraHeadContent` | string | `''` | content | Custom HTML injected into `<head>` of all pages |
| `footer` | `footer` | string | `''` | content | Custom footer HTML (no `pp_` prefix — legacy compatibility) |

Properties with `excludeFromXml: true` are **not** emitted to `<odeProperties>`:

| Internal key | Reason excluded |
|---|---|
| `odeIdentifier` | Written to `<odeResources>` as `odeId`; stored internally in Yjs but not in the property section. |
| `createdAt` | Internal timestamp; not persisted to XML. |
| `modifiedAt` | Internal timestamp; not persisted to XML. |
| `scormIdentifier` | Goes into the SCORM manifest (`imsmanifest.xml`), not `content.xml`. |
| `masteryScore` | Goes into the SCORM manifest, not `content.xml`. |

---

## Boolean serialization

Booleans are stored as the literal strings `"true"` or `"false"`. The `valueToXmlString()` function (`metadata-properties.ts:354–360`) handles this:

```typescript
export function valueToXmlString(key: string, value: unknown): string {
    const config = getPropertyConfig(key);
    if (config?.type === 'boolean') {
        return value === true || value === 'true' ? 'true' : 'false';
    }
    return String(value ?? '');
}
```

The XSD (`ode-content.xsd:242–249`) defines a `booleanStringType` that accepts `"true"`, `"false"`, `"True"`, and `"False"`. On import, the parser normalises these via `value.toLowerCase() === 'true'`.

---

## Round-trip: XML key to internal key mapping

On import, `xml-parser.ts` reads each `<odeProperty>` and maps its `<key>` text back to the internal property name using `getInternalKeyForXmlKey()` (`metadata-properties.ts:287–290`):

```typescript
export function getInternalKeyForXmlKey(xmlKey: string): string | undefined {
    const config = getPropertyConfigByXmlKey(xmlKey);
    return config?.key;
}
```

`getPropertyConfigByXmlKey()` performs a **case-insensitive** lookup by lowercasing both the candidate key and the stored `xmlKey` values:

```typescript
export function getPropertyConfigByXmlKey(xmlKey: string): MetadataPropertyConfig | undefined {
    const lowerXmlKey = xmlKey.toLowerCase();
    return METADATA_PROPERTIES.find(p => p.xmlKey.toLowerCase() === lowerXmlKey);
}
```

This means `pp_Title`, `PP_TITLE`, and `pp_title` all resolve to the internal key `title`. Keys not found in `METADATA_PROPERTIES` are currently dropped by the parser (no fallback passthrough for unknown keys).

---

## Legacy `.elp` files

Legacy `.elp` files use Python pickle XML (`contentv3.xml`), not ODE 2.0. Metadata is stored as a `<dictionary>` of Python object fields, not `<odeProperty>` entries. The `LegacyXmlParser.ts` handles this format. For full details see [Legacy ELP Format (contentv3.xml)](../contentv3-format.md).

---

## Annotated example: all three sections fully populated

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">

  <!-- Section 1: user-level configuration -->
  <userPreferences>
    <userPreference>
      <key>theme</key>
      <value>base</value>        <!-- only key emitted by modern generator -->
    </userPreference>
  </userPreferences>

  <!-- Section 2: package-level identifiers -->
  <odeResources>
    <odeResource>
      <key>odeId</key>
      <value>20260427090000PROJID</value>    <!-- stable; never regenerated -->
    </odeResource>
    <odeResource>
      <key>odeVersionId</key>
      <value>20260427091500VERSID</value>    <!-- new on every export -->
    </odeResource>
    <odeResource>
      <key>exe_version</key>
      <value>3.0</value>                    <!-- ODE_VERSION constant -->
    </odeResource>
  </odeResources>

  <!-- Section 3: document metadata -->
  <odeProperties>
    <!-- Core metadata -->
    <odeProperty><key>pp_title</key><value>Introduction to Biology</value></odeProperty>
    <odeProperty><key>pp_subtitle</key><value>Unit 1</value></odeProperty>
    <odeProperty><key>pp_author</key><value>Jane Doe</value></odeProperty>
    <odeProperty><key>pp_description</key><value>First-year biology overview.</value></odeProperty>
    <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
    <odeProperty><key>pp_license</key><value>creative commons: attribution - share alike 4.0</value></odeProperty>
    <odeProperty><key>pp_licenseUrl</key><value>https://creativecommons.org/licenses/by-sa/4.0/</value></odeProperty>
    <odeProperty><key>pp_keywords</key><value>biology, cells, ecology</value></odeProperty>
    <odeProperty><key>pp_category</key><value>Science</value></odeProperty>
    <odeProperty><key>pp_theme</key><value>base</value></odeProperty>
    <odeProperty><key>pp_exelearning_version</key><value>4.0.0</value></odeProperty>

    <!-- Export options: booleans serialized as "true"/"false" strings -->
    <odeProperty><key>pp_addExeLink</key><value>true</value></odeProperty>
    <odeProperty><key>pp_addPagination</key><value>false</value></odeProperty>
    <odeProperty><key>pp_addSearchBox</key><value>true</value></odeProperty>
    <odeProperty><key>pp_addAccessibilityToolbar</key><value>true</value></odeProperty>
    <odeProperty><key>pp_addMathJax</key><value>false</value></odeProperty>
    <!-- exportSource has no pp_ prefix (legacy compatibility) -->
    <odeProperty><key>exportSource</key><value>true</value></odeProperty>
    <odeProperty><key>pp_globalFont</key><value>default</value></odeProperty>

    <!-- Custom content: HTML-escaped (stored in XML text nodes) -->
    <odeProperty>
      <key>pp_extraHeadContent</key>
      <value>&lt;meta name="robots" content="index,follow"&gt;</value>
    </odeProperty>
    <!-- footer has no pp_ prefix (legacy compatibility) -->
    <odeProperty>
      <key>footer</key>
      <value>&lt;p&gt;© 2026 Jane Doe&lt;/p&gt;</value>
    </odeProperty>
  </odeProperties>

  <!-- Excluded from odeProperties (not emitted):          -->
  <!--   odeIdentifier → odeResources/odeId                -->
  <!--   createdAt, modifiedAt → internal Yjs only         -->
  <!--   scormIdentifier, masteryScore → SCORM manifest    -->

  <odeNavStructures>
    <!-- ... pages ... -->
  </odeNavStructures>
</ode>
```
