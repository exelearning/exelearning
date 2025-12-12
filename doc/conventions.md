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

## Adding New Conventions

When adding new conventions to this document:

1. Provide clear background context
2. Include before/after examples where applicable
3. Document when the convention applies and when it doesn't
4. Reference the implementation files
5. Explain the rationale
6. Update related code comments to reference this document
