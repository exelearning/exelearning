# ELPX Identifiers

This document describes every identifier used in a `content.xml` file: their format, generation, lifecycle, synchronization rules, and what happens to them during import.

See also: [ELPX format overview](../elpx-format.md) | [Container](container.md) | [Pages and blocks](pages-blocks.md) | [Metadata](metadata.md)

---

## ID format

Modern ODE identifiers are produced by `generateOdeId()` in `OdeXmlGenerator.ts:315–332`:

```
YYYYMMDDHHmmss  +  6 chars from [A-Z0-9]
```

**Example:** `20251125215856KTWCLS`

- Characters 1–14: UTC wall-clock timestamp, zero-padded (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`).
- Characters 15–20: six characters drawn uniformly at random from the 36-character alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`.

This gives the ID two useful properties: it is lexicographically time-sortable (earlier IDs sort before later ones), and the 6-character random suffix makes collisions extremely unlikely even when many IDs are generated within the same second.

```typescript
// OdeXmlGenerator.ts:315–332
export function generateOdeId(): string {
    const now = new Date();
    const timestamp =
        now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let random = '';
    for (let i = 0; i < 6; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return timestamp + random;
}
```

---

## XSD `odeIdentifierType` pattern

The XML Schema (`ode-content.xsd:148–152`) defines a union pattern for all ID attributes:

```
[0-9]{14}[A-Z0-9]{6}|page-[a-z0-9-]+|[a-zA-Z0-9_-]+
```

The three alternations exist for distinct historical reasons:

| Alternation | Example | Reason |
|---|---|---|
| `[0-9]{14}[A-Z0-9]{6}` | `20251125215856KTWCLS` | Modern format produced by `generateOdeId()`. |
| `page-[a-z0-9-]+` | `page-introduction` | Slug-style IDs used in older eXeLearning 3.x imports where page IDs were derived from page titles. |
| `[a-zA-Z0-9_-]+` | `idevice-3` or `page-4` | Generic legacy IDs from Python eXeLearning 2.x (`.elp` files) where pages and iDevices had small sequential integers as identifiers. |

All three forms are accepted by the importer. The modern generator always produces the first form.

---

## Identifier lifecycle

| Identifier | Set when | Changes when | Notes |
|---|---|---|---|
| `odeId` | Project is created for the first time | Never (stable for the project's lifetime) | Stored in `odeResources`. Retrieved from `meta.odeIdentifier` if already set, otherwise `generateOdeId()` is called once (`OdeXmlGenerator.ts:44`). |
| `odeVersionId` | Every export / save | Every export / save | Always a freshly generated `generateOdeId()` call (`OdeXmlGenerator.ts:45`). Acts as a change cursor. |
| `odePageId` | Page is created | On import (reassigned — see below) | Stable within a project; changes only when the file is re-imported. |
| `odeBlockId` | Block is created | On import (reassigned) | Stable within a project; changes only when the file is re-imported. |
| `odeIdeviceId` | iDevice is added | On import (reassigned) | Stable within a project; changes only when the file is re-imported. |

---

## Synchronization: redundant IDs inside blocks and components

The DTD (`content.dtd:69`) requires `<odePageId>` as the first child of every `<odePagStructure>` (block), and again as the first child of every `<odeComponent>`. These are not independent IDs — they must equal the `<odePageId>` of the enclosing `<odeNavStructure>`.

The generator enforces this in lockstep:

```typescript
// OdeXmlGenerator.ts:203–205 (block generation)
xml += `    <odePagStructure>\n`;
xml += `      <odePageId>${escapeXml(pageId)}</odePageId>\n`;   // pageId passed from parent
xml += `      <odeBlockId>${escapeXml(blockId)}</odeBlockId>\n`;

// OdeXmlGenerator.ts:262–265 (component generation)
xml += `        <odeComponent>\n`;
xml += `          <odePageId>${escapeXml(pageId)}</odePageId>\n`;   // same pageId, passed down
xml += `          <odeBlockId>${escapeXml(blockId)}</odeBlockId>\n`; // blockId from enclosing block
xml += `          <odeIdeviceId>${escapeXml(componentId)}</odeIdeviceId>\n`;
```

In other words: `pageId` is threaded through from `generateOdeNavStructureXml()` → `generateOdePagStructureXml()` → `generateOdeComponentXml()` as a function argument, so the emitted values are always in lockstep with the enclosing structure.

A parser that encounters a mismatch between the block's `<odePageId>` and its parent `<odeNavStructure>`'s `<odePageId>` should treat the outer (navigation-level) value as authoritative.

---

## ID collision handling on import

Every time an `.elpx` or `.elp` file is imported, **all page IDs are regenerated**. This happens unconditionally, even when `clearExisting: true` replaces the entire Y.Doc.

### Modern format (`.elpx`)

`buildFlatPageList()` (`ElpxImporter.ts:955`) calls `this.generateId('page')` for every `<odeNavStructure>` it encounters, mapping the original XML ID to the new one via an `idRemap: Map<string, string>`. Block IDs and iDevice IDs are similarly regenerated inside `buildPageData()`.

The importer's `generateId()` (`ElpxImporter.ts:1824`) uses a different format from the exporter's `generateOdeId()`:

```
<prefix>-<Date.now().toString(36)>-<Math.random().toString(36).substring(2,11)>
```

Examples: `page-m4x1z2-ab3cd4ef5`, `block-m4x1z3-xyz987`.

This format matches the `page-[a-z0-9-]+` and `[a-zA-Z0-9_-]+` alternations in the XSD identifier pattern, and it is always globally unique within a session because `Date.now()` advances between calls.

### Legacy format (`.elp`)

`convertLegacyPagesToPageData()` (`ElpxImporter.ts:644–688`) builds a full `pageIdRemap` map before processing any page, so that parent-child relationships (which reference old IDs) can be resolved consistently using the new IDs.

The rationale for always remapping (even on full replacement) is stated in a comment at `ElpxImporter.ts:653`:

> "Legacy IDs are stable inside .elp files (e.g. page-4, idevice-2). On repeated imports into the same Y.Doc we must remap to unique IDs to avoid collisions."

This applies equally to modern ELPX imports: importing the same `.elpx` twice into one Y.Doc must produce distinct page IDs.

### Internal link repair

After all IDs are remapped, `remapInternalPageLinks()` (`ElpxImporter.ts:1453–1479`) walks every component's `htmlView` and `properties` (recursively) and rewrites `exe-node:<oldId>` references to `exe-node:<newId>`. Both the HTML attribute value and the JSON stored in `jsonProperties` are updated — for example, a `text` iDevice stores its content in `jsonProperties.textTextarea`, not only in `htmlView`, so both locations must be patched.

The rewrite uses a single compiled regex that matches all old IDs in one pass, preserving any `#fragment` suffix:

```
href="exe-node:oldId"           → href="exe-node:newId"
href="exe-node:oldId#section1"  → href="exe-node:newId#section1"
```

---

## Annotated example: IDs in a two-page export

```xml
<odeResources>
  <odeResource>
    <key>odeId</key>
    <!-- Stable project identifier, never regenerated after first creation -->
    <value>20251125215855LURLBW</value>
  </odeResource>
  <odeResource>
    <key>odeVersionId</key>
    <!-- Regenerated on every export/save -->
    <value>20251125220103ABCXYZ</value>
  </odeResource>
  <odeResource>
    <key>exe_version</key>
    <value>3.0</value>
  </odeResource>
</odeResources>

<odeNavStructures>
  <odeNavStructure>
    <odePageId>20251125215855PAGE01</odePageId>   <!-- page ID -->
    <odeParentPageId/>                            <!-- root: no parent -->
    ...
    <odePagStructures>
      <odePagStructure>
        <odePageId>20251125215855PAGE01</odePageId> <!-- must match enclosing page -->
        <odeBlockId>20251125215855BLK001</odeBlockId>
        ...
        <odeComponents>
          <odeComponent>
            <odePageId>20251125215855PAGE01</odePageId>  <!-- must match enclosing page -->
            <odeBlockId>20251125215855BLK001</odeBlockId> <!-- must match enclosing block -->
            <odeIdeviceId>20251125215855IDEV01</odeIdeviceId>
            ...
          </odeComponent>
        </odeComponents>
      </odePagStructure>
    </odePagStructures>
  </odeNavStructure>

  <odeNavStructure>
    <odePageId>20251125215855PAGE02</odePageId>
    <!-- child of PAGE01: href="exe-node:PAGE01" would link back to parent -->
    <odeParentPageId>20251125215855PAGE01</odeParentPageId>
    ...
  </odeNavStructure>
</odeNavStructures>
```
