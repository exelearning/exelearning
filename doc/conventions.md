# Project Conventions

This document describes stable conventions and behaviors in the eXeLearning codebase that are intentional and should not be changed without careful consideration and updating this documentation.

---

## Legacy .elp (v2.x) Import – Root Node Flattening

### Background

Legacy `contentv3.xml` files from eXeLearning 2.x have a structural pattern where:

- A **single root node** acts as a container for the entire document
- All meaningful content pages are **children of that root node**
- The root node has a title and metadata, but conceptually behaves like a wrapper

This structure does **not** match the target content model of the new version, where multiple top-level pages are expected.

### Transformation Rule

When importing a legacy `contentv3.xml` with a single root node that has children:

1. **The legacy root node is imported as the first page** (level 0, no parent)
2. **All direct children of the root are promoted to top-level pages** (level 0, no parent)
3. **Deeper descendants keep their parent relationships** but have their levels recalculated

### Before/After Example

**Legacy Structure (contentv3.xml):**

```
Root
 ├─ Child A
 │   └─ Grandchild A1
 ├─ Child B
 └─ Child C
```

**Imported Structure:**

```
Page 1: Root         (level 0, parent: null)
Page 2: Child A      (level 0, parent: null)      ← promoted
Page 3: Grandchild A1 (level 1, parent: Child A)   ← preserved
Page 4: Child B      (level 0, parent: null)      ← promoted
Page 5: Child C      (level 0, parent: null)      ← promoted
```

### Key Points

| Aspect | Behavior |
|--------|----------|
| Root node | Becomes first top-level page |
| Root's direct children | Promoted to top-level (no parent) |
| Grandchildren | Keep parent relationship, level recalculated |
| Deeper nesting | Relationships preserved, levels adjusted |
| Content & metadata | Fully preserved |
| iDevices | Fully preserved |

### When Flattening Applies

Flattening is applied **only** when:

1. The document has **exactly one root node** (a node with no parent)
2. That root node has **at least one direct child**

Flattening is **not** applied when:

- There are multiple root nodes (structure is already flat)
- The single root has no children (nothing to flatten)

### Implementation Details

The flattening logic is implemented in:

- **File:** `src/services/xml/legacy-xml-parser.ts`
- **Functions:** `shouldFlattenRootChildren()`, `flattenRootChildren()`
- **Integration point:** `buildPageHierarchy()`

### Rationale

This transformation ensures that:

1. Legacy documents import into a **clean, predictable top-level structure**
2. The content model aligns with the new version's expectations
3. Users don't need to manually reorganize imported content

### Important Notes

- This behavior is **intentional and by design** – it is not a bug
- This transformation applies **only to legacy v2.x imports** (`contentv3.xml`)
- Do not change this behavior without updating:
  - The code comments in `legacy-xml-parser.ts`
  - This documentation
  - The test suite

---

## Legacy .elp (v2.x) Import – iDevice Box Splitting

### Background

Legacy `contentv3.xml` files from eXeLearning 2.x have a layout limitation:

- Pages can contain **multiple iDevices**
- Each iDevice has its **own title**
- The legacy format does **not** explicitly define layout boxes (blocks)

Without special handling, the import process would:

- Create **one single box per page**
- Place **all iDevices inside that box**
- Cause **loss of individual iDevice titles**

### Transformation Rule

When importing a legacy `contentv3.xml`:

1. **Each iDevice is placed in its own box** (block)
2. **The iDevice's title becomes the box title**
3. **No iDevices are grouped together** in a single box
4. **Order of iDevices is preserved**

### Before/After Example

**Legacy Page (contentv3.xml):**

```
Page
 └─ idevices list
     ├─ iDevice: Introduction (title: "Introduction")
     ├─ iDevice: Objectives (title: "Objectives")
     └─ iDevice: Activity (title: "Activity")
```

**Imported Structure:**

```
Page
 ├─ Box: "Introduction"
 │   └─ iDevice
 ├─ Box: "Objectives"
 │   └─ iDevice
 └─ Box: "Activity"
     └─ iDevice
```

### Key Points

| Aspect | Behavior |
|--------|----------|
| iDevices per box | Exactly one |
| Box title | Taken from iDevice title |
| iDevice order | Preserved |
| Missing titles | Default to empty string |

### When Box Splitting Applies

Box splitting is applied **only** when:

- Opening or importing **legacy `.elp` files (v2.x / contentv3.xml)**
- Files use the Python pickle-based format

### When Box Splitting Does NOT Apply

Box splitting is **not** applied to:

- **Modern `.elpx` files** – existing box structure is preserved as-is
- **New projects** – no legacy conversion needed
- **Content already using modern layout** – boxes and iDevices remain unchanged

### Implementation Details

The box splitting logic is implemented in:

**Backend:**
- **File:** `src/services/xml/legacy-xml-parser.ts`
- **Functions:** `extractIdeviceTitle()`, `extractComponents()`, `convertPagesToRealOdeNavStructures()`

**Frontend:**
- **File:** `public/app/yjs/LegacyXmlParser.js`
- **Functions:** `extractIdeviceTitle()`, `extractNodeBlocks()`, `extractIDevicesWithTitles()`

### Rationale

This transformation ensures that:

1. **iDevice titles are never lost** during import
2. Imported content matches the **mental model of modern layouts**
3. Users don't need to **manually split boxes** after import
4. Each content block has a **meaningful, descriptive title**

### Important Notes

- This behavior is **intentional and by design** – it is not a bug
- This transformation applies **only to legacy v2.x imports** (`contentv3.xml`)
- **Modern `.elpx` files are NOT affected** – their box structure is preserved
- Do not change this behavior without updating:
  - The code comments in both backend and frontend parsers
  - This documentation
  - The test suite

---

## Legacy .elp (v2.x) Import – Editable iDevice Conversion

### Background

Legacy `contentv3.xml` files from eXeLearning 2.x contain iDevices that were implemented as **specialized variants of a Text iDevice**, distinguished mainly by:

- An **icon** (e.g., lightbulb for Reflection, document for Activity)
- A **semantic label** (e.g., "Prior Knowledge", "Objectives", "Reflection")

Examples of such legacy iDevice types include:

- Activity
- Reading Activity
- Prior Knowledge
- Objectives
- Reflection
- FreeText, GenericIdevice
- Spanish FPD variants (Tareas, Comillas, NotaInformacion, etc.)

### The Editability Problem

These legacy iDevices:

- Were technically **Text-based** containers
- Relied on the **legacy editor logic**
- Have **no direct editable equivalent** in modern eXeLearning

If imported verbatim without conversion:

| Issue | Symptom |
|-------|---------|
| Edit button disabled | `btn-edit-idevice disabled` class present |
| Undefined identifier | `identifier="undefined"` in DOM |
| Content locked | Double-click opens editor but content cannot be modified |
| User frustration | iDevice is effectively **read-only** |

### Historical Precedent (Symfony Legacy)

In the **Symfony legacy implementation**, a specific workaround existed:

- When opening a legacy `.elp` in eXe 3:
  - These specialized legacy iDevices were **converted into a standard Text iDevice**
  - The content was preserved
  - The result was fully editable

This behavior is **recovered and preserved** in the current implementation.

### Transformation Rule

When opening or importing a legacy `.elp` (`contentv3.xml`):

1. **Detect legacy text-based iDevices** that have no modern editable counterpart
2. **Automatically convert them to modern Text iDevice** (`type: 'text'`)
3. **Preserve the original content** (HTML)
4. **Preserve the original title** (if present)
5. Ensure the resulting iDevice:
   - Has a **valid identifier**
   - Has the **Edit button enabled**
   - Is **fully editable** in modern eXeLearning

### iDevice Conversion Table

**Text-based iDevices (convert to `text`):**

| Legacy iDevice Type | Description | Conversion |
|---------------------|-------------|------------|
| FreeTextIdevice | Free text content | → text |
| FreeTextfpdIdevice | FPD variant | → text |
| GenericIdevice | Generic iDevice | → text |
| ReflectionIdevice | Reflection activity | → text |
| ReflectionfpdIdevice | FPD variant | → text |
| ReflectionfpdmodifIdevice | Modified FPD variant | → text |
| TareasIdevice | Tasks (Spanish) | → text |
| ListaApartadosIdevice | List sections (Spanish) | → text |
| ComillasIdevice | Quotes (Spanish) | → text |
| NotaInformacionIdevice | Note/Information | → text |
| NotaIdevice | Note | → text |
| CasopracticofpdIdevice | Case study FPD | → text |
| CitasparapensarfpdIdevice | Quotes to think | → text |
| DebesconocerfpdIdevice | Must know | → text |
| DestacadofpdIdevice | Highlighted | → text |
| OrientacionestutoriafpdIdevice | Teacher guidelines | → text |
| OrientacionesalumnadofpdIdevice | Student guidelines | → text |
| ParasabermasfpdIdevice | To learn more | → text |
| RecomendacionfpdIdevice | Recommendation | → text |
| EjercicioresueltofpdIdevice | Solved exercises | → text |
| WikipediaIdevice | Wikipedia embed | → text |
| RssIdevice | RSS feed | → text |
| AppletIdevice | Java applet (obsolete) | → text |

**Interactive iDevices (mapped to modern equivalents):**

| Legacy iDevice Type | Modern Type |
|---------------------|-------------|
| TrueFalseIdevice | trueorfalse |
| VerdaderofalsofpdIdevice | trueorfalse |
| MultichoiceIdevice | quick-questions-multiple-choice |
| EleccionmultiplefpdIdevice | quick-questions-multiple-choice |
| MultiSelectIdevice | quick-questions-multiple-choice |
| SeleccionmultiplefpdIdevice | quick-questions-multiple-choice |
| ClozeIdevice | complete |
| ClozefpdIdevice | complete |
| ClozelangfpdIdevice | complete |
| ImageMagnifierIdevice | magnifier |
| GalleryIdevice | image-gallery |
| CasestudyIdevice | casestudy |
| FileAttachIdevice, AttachmentIdevice | text (for editability) |
| ExternalUrlIdevice | external-website |
| QuizTestIdevice | quick-questions |

**Modern iDevices:**

| iDevice Type | Handling |
|--------------|----------|
| JsIdevice | Preserved (modern JSON-based iDevice system) |

**Fallback:**

Any unrecognized legacy iDevice type is **converted to `text`** to ensure editability.

### When This Applies

This conversion is applied **only** when:

- Opening or importing **legacy `.elp` files (v2.x / contentv3.xml)**
- Files use the Python pickle-based format

### When This Does NOT Apply

Conversion is **not** applied to:

- **Modern `.elpx` files** – iDevice types are preserved as defined
- **New projects** – no legacy conversion needed
- **Native EXENEW iDevices** – already use modern type system

### Implementation Details

The conversion logic is implemented in **both** backend and frontend:

**Backend:**
- **File:** `src/services/xml/legacy-xml-parser.ts`
- **Function:** `mapIdeviceType()`

**Frontend:**
- **File:** `public/app/yjs/LegacyXmlParser.js`
- **Function:** `mapIdeviceType()`

Both implementations must be kept in sync. When adding new iDevice type mappings, update both files.

### Rationale

**"Editable content takes precedence over preserving obsolete iDevice types."**

This transformation ensures that:

1. **No legacy content becomes read-only** – users can always edit their content
2. **Content is preserved exactly** – only the iDevice type metadata changes
3. **User experience is consistent** – all iDevices behave the same way
4. **Legacy compatibility is maintained** – matches historical eXe 3 behavior

### Important Notes

- This behavior is **intentional and by design** – it is not a bug
- This transformation applies **only to legacy v2.x imports** (`contentv3.xml`)
- **Modern `.elpx` files are NOT affected** – their iDevice types are preserved
- Do not change this behavior without updating:
  - The code comments in `legacy-xml-parser.ts` (backend)
  - The code comments in `LegacyXmlParser.js` (frontend)
  - This documentation
  - The test suite

---

## Legacy .elp (v2.x) Import – iDevice Icon Mapping

### Background

Legacy `contentv3.xml` files from eXeLearning 2.x store **icon names** directly in the iDevice dictionary:

```xml
<string role="key" value="icon"/>
<unicode value="preknowledge"/>
```

These icon names correspond to theme icon files (e.g., `think.png`, `objectives.png`).

### The Icon Problem

Some legacy icon names do **not** directly match modern theme icon filenames:

| Legacy Icon Name | Theme Icon File |
|------------------|-----------------|
| `preknowledge` | `think.png` |
| `reading` | `book.png` |
| `casestudy` | `case.png` |

Without mapping, these icons would not display correctly in the imported content.

### Transformation Rule

When importing a legacy `contentv3.xml`:

1. **Extract the icon name** from the iDevice dictionary (`icon` field)
2. **Map legacy icon names** to modern theme icon names (if different)
3. **Assign the icon to the block** (not the iDevice)
4. **Icons that match directly** (e.g., `objectives`, `reflection`) pass through unchanged

### Icon Mapping Table

| Legacy Icon Name | Theme Icon Name | Theme File |
|------------------|-----------------|------------|
| `preknowledge` | `think` | `think.png` |
| `reading` | `book` | `book.png` |
| `casestudy` | `case` | `case.png` |
| `objectives` | `objectives` | `objectives.png` (no change) |
| `reflection` | `reflection` | `reflection.png` (no change) |
| `activity` | `activity` | `activity.png` (no change) |
| `video` | `video` | `video.png` (no change) |
| `info` | `info` | `info.png` (no change) |
| `technology` | `technology` | `technology.png` (no change) |
| `file` | `file` | `file.png` (no change) |
| `pieces` | `pieces` | `pieces.png` (no change) |
| `draw` | `draw` | `draw.png` (no change) |
| `competencies` | `competencies` | `competencies.png` (no change) |

### Theme Icon Availability

Icons are loaded from the theme's `icons/` directory. Available icons in the base theme include:

- `activity`, `agreement`, `alert`, `arts`, `ask`, `book`, `calculate`, `case`
- `chrono`, `collaborative`, `competencies`, `diary`, `diary_alt`, `discuss`
- `download`, `draw`, `english`, `experiment`, `explore`, `file`, `gallery`
- `geography`, `guide`, `history`, `info`, `interactive`, `letters`, `listen`
- `math`, `music`, `nature`, `objectives`, `observe`, `passport`, `perform`
- `piece`, `pieces`, `play`, `present`, `reflection`, `roadmap`, `share`
- `sport`, `start`, `stop`, `suitcase`, `technology`, `think`, `think_alt`, `video`

### Key Points

| Aspect | Behavior |
|--------|----------|
| Icon source | iDevice's `icon` field in dictionary |
| Icon destination | Block's `iconName` property |
| Missing icons | Empty string (no icon displayed) |
| Unknown icons | Passed through as-is (may not display if not in theme) |

### When Icon Mapping Applies

Icon mapping is applied **only** when:

- Opening or importing **legacy `.elp` files (v2.x / contentv3.xml)**
- The iDevice has an `icon` field in its dictionary

### Implementation Details

The icon mapping logic is implemented in:

- **File:** `public/app/yjs/LegacyXmlParser.js`
- **Static property:** `LegacyXmlParser.LEGACY_ICON_MAP`
- **Functions:** `extractIDevicesWithTitles()`, `extractNodeBlocks()`

The icon is stored on the block (not the iDevice) because in the modern system, icons are a block-level property.

### Rationale

This transformation ensures that:

1. **Visual appearance is preserved** from legacy content
2. **Theme icons display correctly** without user intervention
3. **Semantic meaning** of iDevices (Objectives, Reflection, etc.) is visible via icons
4. **User experience is consistent** with the original content

### Important Notes

- This behavior is **intentional and by design** – it is not a bug
- This transformation applies **only to legacy v2.x imports** (`contentv3.xml`)
- **Modern `.elpx` files are NOT affected** – their icons are preserved as-is
- Do not change this behavior without updating:
  - The `LEGACY_ICON_MAP` in `LegacyXmlParser.js`
  - This documentation
  - The test suite

---

## Legacy .elp (v2.x) Import – Identifier Regeneration on Open

### Background

Legacy `.elp` files store page, block, and iDevice identifiers as small sequential strings (e.g. `page-4`, `idevice-2`) baked in at the time the file was last saved by eXeLearning 2.x. These identifiers were stable inside the original Python implementation but are **not unique** across files and would collide if two legacy `.elp` files were merged into the same Y.Doc.

Modern `.elpx` files carry a stable project identity (`odeId`) and ODE-style page/block/iDevice IDs (`YYYYMMDDHHmmss + 6 chars`). See [elpx-format/ids.md](elpx-format/ids.md).

### Transformation Rule

When a legacy `.elp` is opened or imported, the importer **regenerates every identifier**:

1. A new project `odeId` and `odeVersionId` are minted (legacy `.elp` has no equivalent).
2. Every `<odePageId>`, `<odeBlockId>`, and `<odeIdeviceId>` is replaced with a freshly generated unique ID.
3. Parent-child page relationships and internal `exe-node:<id>` links are remapped to the new IDs (`remapInternalPageLinks()` in `ElpxImporter.ts`).

This is unconditional: it happens on every open of a legacy `.elp`, including repeated opens of the same file in different sessions.

### User-Visible Consequence

The same `.elp` opened twice produces **two different sets of identifiers**. In particular:

- Open `lesson.elp` → export to SCORM without saving → SCORM manifest contains IDs `A`.
- Reopen the same `lesson.elp` → export to SCORM again without saving → SCORM manifest contains IDs `B ≠ A`.

For the typical authoring flow this is harmless: the user saves the project once as `.elpx`, and from that point on the identifiers are stable across opens (modern `.elpx` round-trips preserve `odeId`/`odeVersionId` and the importer remap only fires once at the legacy → modern migration boundary).

However, workflows that **use a legacy `.elp` as a source of truth and re-export from it repeatedly** (without ever saving as `.elpx`) will see SCORM/HTML5/EPUB output whose internal identifiers drift between exports. LMS systems that key tracking on these identifiers may treat each re-export as a brand-new package.

### Recommended Workflow

To get stable identifiers across re-exports from a legacy `.elp`:

1. Open the `.elp` once.
2. **Save as `.elpx`** — this commits the freshly generated `odeId` and `odeVersionId` to the modern format.
3. From then on, open and re-export the `.elpx`. Identifiers are preserved across the round-trip.

### When This Applies

Identifier regeneration applies **only** when:

- Opening or importing **legacy `.elp` files** (v2.x / `contentv3.xml`, Python pickle-based format).
- Opening or importing **modern `.elpx` files** into a Y.Doc that already contains content (collision avoidance — same mechanism).

It does **not** apply to:

- Reopening a modern `.elpx` into an empty workspace — `odeId` and `odeVersionId` are restored from `<odeResources>`, so output is byte-stable across saves (see `OdeXmlGenerator.ts:44–45`).

### Implementation Details

- **Generator:** `generateOdeId()` in `src/shared/export/OdeXmlGenerator.ts`
- **Importer remap:** `buildFlatPageList()`, `convertLegacyPagesToPageData()`, `generateId()`, and `remapInternalPageLinks()` in `src/services/import/ElpxImporter.ts`
- **Reference docs:** [elpx-format/ids.md](elpx-format/ids.md), [elpx-format/import-pipeline.md](elpx-format/import-pipeline.md)

### Rationale

Legacy `.elp` identifiers are not globally unique and cannot be reused safely. Regeneration on every open guarantees that:

1. **Two different `.elp` files** can be merged into one Y.Doc without identifier collisions.
2. **Repeated imports** of the same `.elp` into one Y.Doc do not silently overwrite existing pages.
3. **Internal links** (`exe-node:<id>`) remain valid because the remap walks every component's HTML and JSON properties.

The cost — non-deterministic IDs across reopens of the same `.elp` — is acceptable because the legacy format is a one-way migration source, not a long-term storage format. Users who need stable IDs are expected to save once as `.elpx`.

### Important Notes

- This behavior is **intentional and by design** – it is not a bug.
- It is the reason why opening the same legacy `.elp` twice yields different SCORM manifests.
- Do not change this behavior without updating:
  - The code comments at `ElpxImporter.ts:653` and around `OdeXmlGenerator.ts:44`
  - This documentation
  - [elpx-format/ids.md](elpx-format/ids.md)
  - The test suite

---

## Adding New Conventions

When adding new conventions to this document:

1. Provide clear background context
2. Include before/after examples where applicable
3. Document when the convention applies and when it doesn't
4. Reference the implementation files
5. Explain the rationale
6. Update related code comments to reference this document
