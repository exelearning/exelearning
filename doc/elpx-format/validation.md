# ELPX Validation

A practical guide to validating `.elpx` packages, their `content.xml`, and the
HTML output they carry.

Related documents: [export-pipeline.md](./export-pipeline.md) |
[import-pipeline.md](./import-pipeline.md)

---

## 1. DTD vs XSD — When Each Is Used

Two schema artefacts ship with the project.

### DTD — `content.dtd`

- **Location in a package:** bundled at the ZIP root alongside `content.xml`.
- **Location in the source tree:** `public/app/schemas/ode/content.dtd` (also
  embedded verbatim as the `ODE_DTD_CONTENT` constant in
  `src/shared/export/constants.ts:1006`).
- **Written into every ELPX** during export phase 2.2
  (`ElpxExporter.ts:363`).
- **Purpose:** offline structural validation. Any XML tool can validate
  `content.xml` without network access by resolving the `SYSTEM "content.dtd"`
  declaration against the bundled file.
- **Limitations:** DTD cannot enforce data types, regex patterns, or enumerated
  values — only element presence and nesting.

### XSD — `ode-content.xsd`

- **Location in source:** `public/app/schemas/ode/ode-content.xsd`.
- **Not bundled** in exported `.elpx` packages.
- **Purpose:** stricter offline or CI validation. Adds:
  - `odeIdentifierType` — pattern `[0-9]{14}[A-Z0-9]{6}|page-[a-z0-9-]+|[a-zA-Z0-9_-]+`
    (`ode-content.xsd:148-152`).
  - `ideviceTypeType` — enumeration of all known iDevice type names
    (`ode-content.xsd:158-235`).
  - `booleanStringType` — restricts property values to `true`/`false`/`True`/`False`
    (`ode-content.xsd:242-249`).
  - `propertyKeyType` — enumeration of known `<key>` values in `odeProperties`
    (`ode-content.xsd:255-291`).
  - Integer types on order fields (`odeNavStructureOrder`, `odePagStructureOrder`,
    `odeComponentsOrder`).

### Coverage Matrix

| Check | DTD | XSD |
|---|---|---|
| Root element `<ode>` present | yes | yes |
| `<odeNavStructures>` required | yes | yes |
| `<odePageId>` required in each page | yes | yes |
| `<odeBlockId>` required in each block | yes | yes |
| `<odeIdeviceId>` required in each component | yes | yes |
| `<odeIdeviceTypeName>` required | yes | yes |
| Order fields are integers | no | yes |
| Identifier format (timestamp + random) | no | yes |
| iDevice type must be a known value | no | yes |
| Property keys enumerated | no | yes |
| Boolean string values restricted | no | yes |

---

## 2. Programmatic Validation — `OdeXmlValidator`

`src/services/xml/ode-xml-validator.ts` implements structural validation that
runs at export time and can be called by integrators.

### API

```typescript
import { validateOdeXml, formatValidationErrors } from './ode-xml-validator';
import type { ValidationResult } from './ode-xml-validator';

const result: ValidationResult = validateOdeXml(parsedObject);
// parsedObject is the output of fast-xml-parser or equivalent

if (!result.valid) {
    console.error(formatValidationErrors(result));
}
```

`validateXml(xmlString)` in `src/services/xml/xml-parser.ts:134` wraps
`validateOdeXml` to accept a raw XML string directly:

```typescript
import { validateXml, formatValidationErrors } from '../services/xml/xml-parser';

const result = validateXml(contentXmlString);
if (!result.valid) throw new Error(formatValidationErrors(result));
```

This is the exact call made inside `ElpxExporter.export()` before writing
`content.xml` (`ElpxExporter.ts:350-355`). An invalid XML causes the export to
abort.

### `ValidationResult` shape

```typescript
interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];    // severity: 'error' — block export
    warnings: ValidationError[];  // severity: 'warning' — logged, not blocking
}

interface ValidationError {
    code: string;   // e.g. 'MISSING_PAGE_ID'
    message: string;
    path: string;   // XPath-like, e.g. '/ode/odeNavStructures/odeNavStructure[0]'
    severity: 'error' | 'warning';
}
```

### What the validator checks

- `MISSING_ROOT` — no `<ode>` element (legacy formats are accepted as-is).
- `INVALID_NAMESPACE` — `xmlns` present but not `http://www.intef.es/xsd/ode`
  (warning only).
- `MISSING_NAV_STRUCTURES` — `<odeNavStructures>` absent.
- Per `<odeNavStructure>`: `MISSING_PAGE_ID`, `MISSING_PAGE_NAME`,
  `MISSING_NAV_ORDER`.
- Per `<odePagStructure>`: `MISSING_BLOCK_PAGE_ID`, `MISSING_BLOCK_ID`,
  `MISSING_PAG_ORDER`.
- Per `<odeComponent>`: `MISSING_COMP_PAGE_ID`, `MISSING_COMP_BLOCK_ID`,
  `MISSING_IDEVICE_ID`, `MISSING_IDEVICE_TYPE`, `MISSING_COMP_ORDER`.
- `NO_CONTENT` — component has neither `<htmlView>` nor `<jsonProperties>`
  (warning only, `ode-xml-validator.ts:506-513`).

The validator does **not** check file references inside `htmlView`, asset
presence in `content/resources/`, or HTML well-formedness.

---

## 3. Mandatory Presence Checklist

Use this checklist to verify a third-party `.elpx` package before importing it.

### 3.1 Archive structure

- [ ] ZIP is valid and decompressible by `fflate.unzipSync()`.
- [ ] `content.xml` present at the archive root (or inside `EPUB/` for EPUB3
      packages, or as a single nested `.elp`/`.elpx` at root).
- [ ] `content.dtd` present at the archive root — **required for v4
      packages**. Bundled by `ElpxExporter` from `ODE_DTD_CONTENT`
      (`constants.ts:1006`). Validators (and humans running `xmllint`) need
      it.
- [ ] `index.html` present at the archive root — absence makes the package
      non-viewable offline. The importer tolerates its absence but the package
      is then not self-contained.
- [ ] `screenshot.png` present at the archive root — **required for v4
      packages**. PNG magic bytes `89 50 4E 47 0D 0A 1A 0A` validated. If
      missing on a legacy file, patch with [`scripts/add-screenshot.ts`](../../scripts/add-screenshot.ts).
- [ ] `theme/` directory present with at least `config.xml`, `style.css`,
      `style.js`, and (per v4) `theme/screenshot.png`.
- [ ] `libs/` contains the base libraries from `BASE_LIBRARIES`
      (`constants.ts:325`): `jquery/jquery.min.js`, `common.js`,
      `common_i18n.js`, `exe_export.js`, `bootstrap/bootstrap.bundle.min.js`,
      `bootstrap/bootstrap.min.css`.
- [ ] `idevices/<type>/` directory present for every `<odeIdeviceTypeName>`
      referenced in `content.xml`, with the type's `<type>.js`, `<type>.css`,
      and `<type>.html` files.
- [ ] `content/resources/` mirrors the project's asset tree: assets without
      a `folderPath` live at the root, and user-created folders appear as
      real subdirectories. **Reject** any path matching the legacy v3
      pattern `content/resources/[0-9]{14}[A-Z0-9]{6}/...` — that is a
      per-asset UUID subfolder from a v3 export and should be normalised
      with [`scripts/flatten-elpx.ts`](../../scripts/flatten-elpx.ts) (the
      script preserves user folders, since they never match the ODE-ID
      regex).

### 3.2 `content.xml` structure

- [ ] XML is well-formed (parses without `<parsererror>`).
- [ ] Passes `validateXml()` with zero errors (`valid: true`).
- [ ] Root element is `<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">`.
- [ ] At least one `<odeNavStructure>` child of `<odeNavStructures>`.
- [ ] Every `<odeComponent>` has an `<odePageId>` and `<odeBlockId>` matching
      the `<odePageId>` and `<odeBlockId>` of its enclosing
      `<odeNavStructure>` / `<odePagStructure>`.

### 3.3 Content integrity

- [ ] No unresolved template placeholders remain in any `htmlView` or HTML
      file: `__PLACEHOLDER__`, literal `{{context_path}}` (outside of resolved
      HTML files), `UUID-PAGINA`, `UUID-BLOQUE`.
- [ ] All `src=` / `href=` references in `htmlView` CDATA and in `html/*.html`
      that are relative paths resolve to a file inside the ZIP, or are absolute
      external URLs beginning with `http://` or `https://`.
- [ ] For text-like iDevices: `htmlView` and `jsonProperties.textTextarea` are
      semantically aligned (both represent the same content; `htmlView` is the
      rendered form, `jsonProperties.textTextarea` is the editable source used
      by the workarea).
- [ ] All asset paths under `content/resources/` referenced in `htmlView`
      follow the form `{{context_path}}/<filename>` (v4 flat form) or the
      legacy `{{context_path}}/content/resources/<filename>` form, and the
      corresponding file exists in the ZIP at `content/resources/<filename>`
      (no UUID subfolder).

### 3.4 Optional assets

- [ ] `screenshot.png` (validated as required in §3.1) starts with the PNG
      magic bytes `89 50 4E 47 0D 0A 1A 0A` (8 bytes). The importer validates
      this via `decodeScreenshotToBuffer()` (`ElpxExporter.ts:41-74`) and
      silently discards an invalid screenshot.
- [ ] If `libs/elpx-manifest.js` is present it contains a valid
      `window.__ELPX_MANIFEST__` assignment with a `files` array and
      `projectTitle` string.

---

## 4. Common Rejection Causes

| Cause | Where detected | Notes |
|---|---|---|
| Missing `<odeNavStructures>` element | `validateOdeXml()` / `ode-xml-validator.ts:85` | Export aborts; import produces empty document |
| XML not well-formed (unclosed tag, bad entity) | `DOMParser` in `ElpxImporter.ts:241` | Throws "XML parsing error: …" |
| `content.xml` absent | `ElpxImporter.ts:232` | Error: "content.xml is missing" |
| Multiple nested `.elp`/`.elpx` files at root | `ElpxImporter.ts:193` | Error: "ZIP contains multiple ELP files" |
| `screenshot.png` not valid PNG | `decodeScreenshotToBuffer()` `ElpxExporter.ts:57-70` | Screenshot silently dropped at export time |
| `]]>` inside CDATA not escaped | `escapeCdata()` `OdeXmlGenerator.ts:352` | CDATA closed prematurely; XML becomes malformed |
| `asset://` URLs not resolved in `htmlView` | `addFilenamesToAssetUrls()` `BaseExporter.ts:647` | Broken image/media in exported HTML |
| Duplicate `<odePageId>` values | Not validated by current code | Importer creates two pages with the same Yjs entry; behaviour undefined |
| JSON in `<jsonProperties>` not parseable | `buildComponentData()` `ElpxImporter.ts:1165` | Logs warning, uses empty `{}` — component loses its interactive state |

---

## 5. How to Validate

### 5.1 With `xmllint` (DTD)

Unzip the `.elpx` first, then run from the unzipped directory:

```bash
cd /tmp/my-project-unpacked
xmllint --noout --dtdvalid content.dtd content.xml
```

A clean exit (no output, status 0) means DTD validation passed.

### 5.2 With `xmllint` (XSD)

```bash
xmllint --noout --schema /path/to/ode-content.xsd content.xml
```

The XSD is not bundled inside the ELPX; use the copy from the source tree at
`public/app/schemas/ode/ode-content.xsd`.

Note: `xmllint` validates against the target namespace
`http://www.intef.es/xsd/ode`. The `<ode>` root element must carry
`xmlns="http://www.intef.es/xsd/ode"` for the XSD to match.

### 5.3 Programmatically (`OdeXmlValidator` + `xml-parser`)

```typescript
import { validateXml, formatValidationErrors } from 'src/services/xml/xml-parser';
import * as fs from 'fs';

const xml = fs.readFileSync('content.xml', 'utf-8');
const result = validateXml(xml);

if (!result.valid) {
    console.error('INVALID:\n' + formatValidationErrors(result));
    process.exit(1);
}
if (result.warnings.length > 0) {
    console.warn('WARNINGS:\n' + formatValidationErrors(result));
}
console.log('OK');
```

Pass `{ skipValidation: true }` to `parseFromString()` if you need to parse
without validation (e.g. importing deliberately non-standard files).

Pass `{ strictValidation: true }` to treat warnings as errors.

### 5.4 Full import test (most thorough)

```typescript
import * as Y from 'yjs';
import { ElpxImporter } from 'src/shared/import/ElpxImporter';
import * as fs from 'fs';

const buffer = fs.readFileSync('my-project.elpx');
const ydoc = new Y.Doc();
const importer = new ElpxImporter(ydoc, null);
const result = await importer.importFromBuffer(new Uint8Array(buffer));
console.log(result); // { pages, blocks, components, assets }
```

A successful return proves the file decompresses, parses, and populates a Yjs
document without error.

---

## 6. Recommended Unit Tests for Integrators

Short descriptions of tests worth borrowing from the project test suite when
building tooling that produces or consumes `.elpx` files.

| Test intent | What to assert |
|---|---|
| Round-trip: export then re-import | Page count, page titles, block count, component types, and metadata match the original Y.Doc after a full export → import cycle |
| Malformed XML is rejected | `validateXml()` returns `valid: false` and a meaningful `errors` array when the XML is truncated or has unclosed tags |
| Missing `<odeNavStructures>` produces error | `validateOdeXml()` returns error code `MISSING_NAV_STRUCTURES` |
| Legacy `.elp` import produces correct types | A legacy file with `TrueFalseIdevice` produces a component of type `trueorfalse`; `FreeTextIdevice` produces `text` |
| JsIdevice `adivina-activity` maps to `guess` | Import a file whose `contentv3.xml` has `_iDeviceDir = ".../adivina-activity"` and assert component type is `guess` |
| Screenshot PNG validation | `decodeScreenshotToBuffer()` returns `null` for a JPEG-magic payload and a valid `Uint8Array` for a PNG |
| CDATA with `]]>` survives round-trip | Generate XML with `escapeCdata()`, parse it back, assert the original string is recovered intact |
| Collision-safe filenames | Two pages with identical titles produce distinct filenames in the page filename map |
| Asset path deduplication | Two assets with the same filename but different `folderPath` values produce distinct export paths |
| Internal link remap on incremental import | A page imported twice into the same Y.Doc has no `exe-node:` links pointing to the stale old page IDs |
