# ELPX Import Pipeline

Reference document for the end-to-end process that reads an `.elpx` (or legacy
`.elp`) file and populates a Yjs document with the project structure.

Related documents: [export-pipeline.md](./export-pipeline.md) |
[validation.md](./validation.md)

---

## Architecture Summary

The import path is **entirely browser-side** in the normal workarea flow. The
server never parses ELP/ELPX files during a regular import (`AGENTS.md §7.8`).

Two paths exist:

1. **Direct import (primary):** user selects `.elp`/`.elpx` → browser imports
   in memory via `ElpxImporter` → UI refreshes from Y.Doc → saved to server on
   explicit save/autosave.
2. **Chunked upload (fallback):** browser uploads in 15 MB chunks to
   `POST /api/project/upload-chunk` → server concatenates into a temp file (no
   parsing) → browser reloads workarea with `?import=…` → browser calls
   `DELETE /api/project/cleanup-import` to remove the temp file.

The server-side `ElpxImporter` (`src/shared/import/ElpxImporter.ts`) is also
used by CLI export commands and the external API when they need to build a Y.Doc
from a file on disk.

---

## Phase 1 — Decompression

**Responsibility:** `ElpxImporter.importFromBuffer()` (`ElpxImporter.ts:160`)

```typescript
const zip = fflate.unzipSync(buffer);  // ElpxImporter.ts:173
```

`fflate.unzipSync` decompresses the entire ZIP into a
`Record<string, Uint8Array>` keyed by file path.

After decompression, `unwrapSingleTopLevelDirectory()` (`ElpxImporter.ts:112`)
strips a single top-level folder prefix if every entry shares the same prefix.
This handles archives exported from GitHub (e.g. `repo-main/content.xml`
becomes `content.xml`).

**Nested ELP detection:** if neither `content.xml` nor `contentv3.xml` exists at
root, the importer searches for a single `.elp`/`.elpx` file at root level
(`ElpxImporter.ts:183-195`). If exactly one is found it is recursively
decompressed. If more than one is found an error is thrown.

---

## Phase 2 — Format Detection

**Responsibility:** `ElpxImporter.importFromBuffer()` (`ElpxImporter.ts:196-266`)

The detection logic checks file presence in the following order:

```
content.xml present?      --> modern ODE format
contentv3.xml present?    --> legacy Python pickle format
EPUB/content.xml present? --> EPUB3 package (paths stripped of EPUB/ prefix,
                              then re-evaluated as modern ODE format)
none found?               --> Error: "content.xml is missing"
```

Once the content file is found and decoded, it is parsed with
`@xmldom/xmldom`'s `DOMParser` (`ElpxImporter.ts:241`). Parsing errors raise
immediately.

**Root element inspection** determines the format branch
(`ElpxImporter.ts:250-266`):

| Root element | Format | Handler |
|---|---|---|
| `<ode>` | Modern ODE XML | `importStructure()` |
| `<instance class="exe.engine.package.Package">` or `<dictionary>` | Legacy Python pickle | `LegacyXmlParser` + `importLegacyStructure()` |

---

## Phase 3 — Asset Extraction

**Responsibility:** `importAssets()` called at the start of both
`importStructure()` and `importLegacyStructure()` (`ElpxImporter.ts:376`,
`ElpxImporter.ts:547`)

Assets live inside the ZIP under `content/resources/`. The `AssetHandler`
implementation (`assetHandler`) determines where they end up:

- **Browser:** the `BrowserAssetHandler` stores blobs in the Cache API under
  `exe-assets-{uuid}`.
- **Server / CLI:** the `FileSystemAssetHandler` writes files to
  `FILES_DIR/assets/{projectUuid}/`.

After extraction, `assetMap` is populated (`Map<string, string>`) mapping
original file paths to their new asset UUIDs or internal references. This map
is used later to convert `{{context_path}}/content/resources/<file>` paths back
to `asset://<uuid>` internal references inside `htmlView` and `jsonProperties`.

Progress: `reportProgress('assets', 10 → 50, ...)` (`ElpxImporter.ts:373`, 379`).

---

## Phase 4 — XML Parsing and Page/Block/Component Reconstruction

### 4a — Modern ODE Format: `importStructure()`

**Responsibility:** `ElpxImporter.ts:364`

1. `findNavStructures(xmlDoc)` — collects all `<odeNavStructure>` elements.
2. A `pageMap` is built keying each element by its `<odePageId>` text content.
3. Root-level pages are identified by empty or missing `<odeParentPageId>`, then
   sorted by `<odeNavStructureOrder>`.
4. `buildFlatPageList()` (`ElpxImporter.ts:952`) performs a depth-first
   traversal. For each page:
   - A fresh `newPageId` is generated (`generateId('page')`).
   - `idRemap` records `originalId → newPageId` for later link rewriting.
   - `buildPageData()` (`ElpxImporter.ts:1012`) extracts page name, order,
     properties, and then iterates `<odePagStructure>` elements to build
     `BlockData` objects via `buildBlockData()` (`ElpxImporter.ts:1055`).
   - Within each block, `buildComponentData()` (`ElpxImporter.ts:1095`)
     extracts the iDevice type, `htmlView` CDATA content, `jsonProperties`
     CDATA content (parsed as JSON), and structure properties.

**ID remap for collisions:** because the same ELPX file might be imported
multiple times into the same Y.Doc (incremental import), all page IDs are
regenerated on every import. If `clearExisting = false` (incremental import),
`getNextAvailableOrder()` is called to compute an order offset so new root pages
are appended after existing ones.

**Type normalisation in `buildComponentData()`** (`ElpxImporter.ts:1101-1109`):
the iDevice type is read first from `odeIdeviceTypeDirName` attribute, then
`odeIdeviceTypeName` element text. The `LEGACY_TYPE_ALIASES` map
(`interfaces.ts:193`) is applied:

| Old type name | Mapped to |
|---|---|
| `download-package` | `download-source-file` |

### 4b — Legacy Python Pickle Format: `LegacyXmlParser`

**Responsibility:** `src/shared/import/LegacyXmlParser.ts`

`LegacyXmlParser.parse()` (`LegacyXmlParser.ts:379`) preprocesses the XML
(whitespace normalisation, hex escape decoding), then parses with
`@xmldom/xmldom`.

It finds all `<instance class="exe.engine.node.Node">` elements
(`findAllNodes()`), builds a parent reference map, and reconstructs the page
hierarchy with `buildPageHierarchy()`.

iDevice instances are read from `<instance class="...Idevice">` elements inside
each node's `idevices` list. Type determination follows a three-way branch
(`LegacyXmlParser.ts:1235-1313`):

**Branch 1 — JsIdevice** (`exe.engine.jsidevice.JsIdevice`): the `_iDeviceDir`
dict entry path suffix maps to a modern type via `jsIdeviceTypeMap`
(`LegacyXmlParser.ts:1242`):

| Legacy `_iDeviceDir` suffix | Modern type |
|---|---|
| `adivina-activity` | `guess` |
| `candado-activity` | `padlock` |
| `clasifica-activity` | `classify` |
| `completa-activity` | `complete` |
| `desafio-activity` | `challenge` |
| `descubre-activity` | `discover` |
| `flipcards-activity` | `flipcards` |
| `identifica-activity` | `identify` |
| `listacotejo-activity` | `checklist` |
| `mapa-activity` | `map` |
| `mathematicaloperations-activity` | `mathematicaloperations` |
| `mathproblems-activity` | `mathproblems` |
| `ordena-activity` | `sort` |
| `quext-activity` | `quick-questions` |
| `relaciona-activity` | `relate` |
| `rosco-activity` | `az-quiz-game` |
| `selecciona-activity` | `quick-questions-multiple-choice` |
| `seleccionamedias-activity` | `select-media-files` |
| `sopa-activity` | `word-search` |
| `trivial-activity` | `trivial` |
| `videoquext-activity` | `quick-questions-video` |
| `download-package` | `download-source-file` |
| `form-activity` | `form` |
| `rubrics` | `rubric` |
| `pbl-tools` | `text` |
| (unknown) | `text` |

**Branch 2 — GenericIdevice:** the `__name__` dict entry is read and passed to
`mapGenericIdeviceType()`.

**Branch 3 — all other class names:** `mapIdeviceType(className)`
(`LegacyXmlParser.ts:1110`) is called, which applies two lookup tables:

Text-based legacy types (all map to `text`):

`FreeTextIdevice`, `FreeTextfpdIdevice`, `GenericIdevice`, `TextIdevice`,
`ActivityIdevice`, `TaskIdevice`, `ObjectivesIdevice`, `PreknowledgeIdevice`,
`ReadingActivityIdevice`, `ReflectionIdevice`, `ReflectionfpdIdevice`,
`ReflectionfpdmodifIdevice`, `TareasIdevice`, `ListaApartadosIdevice`,
`ComillasIdevice`, `NotaInformacionIdevice`, `NotaIdevice`,
`CasopracticofpdIdevice`, `CitasparapensarfpdIdevice`, `DebesconocerfpdIdevice`,
`DestacadofpdIdevice`, `OrientacionestutoriafpdIdevice`,
`OrientacionesalumnadofpdIdevice`, `ParasabermasfpdIdevice`,
`RecomendacionfpdIdevice`, `WikipediaIdevice`, `RssIdevice`, `AppletIdevice`,
`FileAttachIdevice`, `AttachmentIdevice`

Interactive legacy types (`interactiveTypeMap`, `LegacyXmlParser.ts:1151`):

| Legacy class name | Modern type |
|---|---|
| `TrueFalseIdevice` | `trueorfalse` |
| `VerdaderofalsofpdIdevice` | `trueorfalse` |
| `MultichoiceIdevice` | `form` |
| `EleccionmultiplefpdIdevice` | `form` |
| `MultiSelectIdevice` | `form` |
| `SeleccionmultiplefpdIdevice` | `form` |
| `ClozeIdevice` | `complete` |
| `ClozefpdIdevice` | `complete` |
| `ClozelangfpdIdevice` | `complete` |
| `ImageMagnifierIdevice` | `magnifier` |
| `GalleryIdevice` | `image-gallery` |
| `CasestudyIdevice` | `casestudy` |
| `EjercicioresueltofpdIdevice` | `casestudy` |
| `ExternalUrlIdevice` | `external-website` |
| `QuizTestIdevice` | `quick-questions` |
| (anything else matching `\w+Idevice`) | `text` |

---

## Phase 5 — Metadata Extraction and Screenshot

**Responsibility:** `extractMetadata()` (`ElpxImporter.ts:881`) and
`extractScreenshotFromZip()` (`ElpxImporter.ts:866`)

For modern ODE format, metadata is read from the `<odeProperties>` element via
`getMetadataProperty()` / `getBooleanMetadataProperty()`. Properties use the
`pp_` prefix convention (`pp_title`, `pp_author`, `pp_lang`, `pp_license`, etc.)
(`ElpxImporter.ts:901-921`).

Theme is extracted from `<userPreferences>` first (key `theme`), falling back to
`odeProperties` key `pp_style` (`ElpxImporter.ts:884-896`).

`setMetadata()` (`ElpxImporter.ts:927`) writes all extracted values into the
Yjs `metadata` Y.Map.

**Screenshot:** `extractScreenshotFromZip()` looks for `screenshot.png` at the
archive root, base64-encodes it, and stores it as a `data:image/png;base64,...`
data URL in `metadata.screenshot` (`ElpxImporter.ts:866-876`, `423-426`).

For legacy format, `setLegacyMetadata()` (`ElpxImporter.ts:793`) sets the same
keys. Legacy files always get `theme = 'base'` and `addMathJax = false`
(`ElpxImporter.ts:800-811`).

---

## Phase 6 — Internal Link Remap

**Responsibility:** `remapInternalPageLinks()` (`ElpxImporter.ts:1453`)

Because all page IDs are regenerated during import, any `href="exe-node:<oldId>"`
links inside `htmlView` content and `jsonProperties` string values must be
updated to point to the new IDs.

A single regex is built from the union of all old IDs
(`ElpxImporter.ts:1457-1458`), then applied to both `comp.htmlView` and all
string values inside `comp.properties` recursively via `remapLinksInObject()`
(`ElpxImporter.ts:1486`). Anchor fragments (`#section`) are preserved.

The same remapping is applied in the legacy path via
`convertLegacyPagesToPageData()` (`ElpxImporter.ts:686`).

---

## Phase 7 — Yjs Transaction

**Responsibility:** `ElpxImporter.ts:466` (modern) / `ElpxImporter.ts:573`
(legacy)

All Y.Doc mutations are wrapped in a single `ydoc.transact()` call to produce
one combined undo step and avoid incremental observer firing.

Inside the transaction:
1. If `clearExisting = true`, the `navigation` Y.Array is cleared
   (`while (navigation.length > 0) navigation.delete(0)`).
2. Metadata is written to the `metadata` Y.Map (only when clearing).
3. Each `PageData` in the flat list is converted to a Y.Map via
   `createPageYMap()` (`ElpxImporter.ts:1279`) and pushed to `navigation`.

Progress advances from 50% to 80% over this phase.

After the transaction, `assetHandler.preloadAllAssets()` is called if available
(phase 4 / 80–100%).

---

## Progress Phases Summary

| Phase constant | Percent range | Description |
|---|---|---|
| `decompress` | 0 → 10 | ZIP decompression |
| `assets` | 10 → 50 | Asset extraction |
| `structure` | 50 → 80 | Page/block/component reconstruction |
| `precache` | 80 → 100 | Asset preloading |

---

## End-to-End Flow Diagram

```
Buffer (.elpx / .elp)
        |
        v
  fflate.unzipSync()  [ElpxImporter.ts:173]
        |
        v
  unwrapSingleTopLevelDirectory()
        |
        +-- nested ELP? --> unzipSync again
        |
        v
  content.xml?  contentv3.xml?  EPUB/content.xml?
        |               |               |
        v               v               v
   DOMParser      LegacyXmlParser   strip EPUB/
        |               |           prefix, retry
        |               |
        |    +----------+
        |    |
        v    v
  importStructure()   importLegacyStructure()
        |                     |
        +----------+----------+
                   |
                   v
          importAssets()  [content/resources/ --> AssetHandler]
                   |
                   v
  extractMetadata() + extractScreenshotFromZip()
                   |
                   v
  buildFlatPageList() / convertLegacyPagesToPageData()
    -- generateId() for all page/block/component IDs
    -- buildComponentData(): read htmlView, jsonProperties
    -- convertContextPathToAssetRefs(): {{context_path}} --> asset://
                   |
                   v
  remapInternalPageLinks()  [exe-node:<old> --> exe-node:<new>]
                   |
                   v
  ydoc.transact()
    -- navigation.delete(0) x N  (if clearExisting)
    -- metadata.set(...)
    -- navigation.push([createPageYMap(pageData)])
                   |
                   v
  assetHandler.preloadAllAssets()
                   |
                   v
  ElpxImportResult { pages, blocks, components, assets, theme, zipContents }
```
