# Project Screenshot in ELPX Packages

This document specifies `screenshot.png` at the root of an `.elpx` ZIP archive — the project-level thumbnail image. It covers the format requirements, the two generation paths, the round-trip through Yjs metadata, and the distinction from the per-theme `theme/screenshot.png`.

> **See also**: [ELPX Format hub](../elpx-format.md) | [Themes](themes.md) | [Libraries](libraries.md) | [Assets](assets.md)

---

## 1. What it is and why it exists

`screenshot.png` is a PNG image placed at the **root** of the `.elpx` ZIP archive. It provides a visual preview of the project's first page without requiring the archive to be fully opened or imported.

In **v4**, every `.elpx` is expected to ship a `screenshot.png` at the root: either the user-provided thumbnail or one generated automatically (see [§5 Two generation paths](#5-two-generation-paths) and [§5.4 Generated placeholder via `add-screenshot.ts`](#54-generated-placeholder-via-add-screenshotts)). The exporter always writes the file, and tooling such as the project browser, validators, and LMS importers may treat its absence as a packaging issue.

Typical use-cases:

- LMS thumbnail grids (Moodle, WordPress, Omeka-S, Drupal LMS plugins).
- File-manager previews in operating systems or CMS media libraries.
- Repository index pages that show thumbnails of published learning objects.
- The eXeLearning project browser, which shows previews of recent projects.

Any tool that can open a ZIP file can extract just the ~100 KB thumbnail in milliseconds without touching the multi-megabyte HTML, library, and asset content.

---

## 2. File location in the archive

`screenshot.png` is always at the archive root — never inside a subdirectory:

```
project.elpx (ZIP)
├── screenshot.png          ← project thumbnail (this document)
├── content.xml
├── index.html
├── theme/
│   └── screenshot.png      ← THEME preview thumbnail (different file)
└── …
```

Example `unzip -l` excerpt:

```
Archive:  project.elpx
  Length      Date    Time    Name
---------  ---------- -----   ----
   102400  2025-04-01 10:00   screenshot.png
 35487232  2025-04-01 10:00   content.xml
   184320  2025-04-01 10:00   index.html
        …                     …
---------                     -------
```

---

## 3. Format specification

### 3.1 Container format

The file must be a **PNG** image. No other image format is accepted.

### 3.2 PNG magic-byte validation

`ElpxExporter.decodeScreenshotToBuffer()` (`src/shared/export/exporters/ElpxExporter.ts:41`) validates the PNG signature before writing the file into the ZIP:

```typescript
private decodeScreenshotToBuffer(screenshot: string): Uint8Array | null {
    // … base64 decode …
    // Validate PNG signature (first 8 bytes)
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&   // 0x89
        bytes[1] === 0x50 &&   // 'P'
        bytes[2] === 0x4e &&   // 'N'
        bytes[3] === 0x47 &&   // 'G'
        bytes[4] === 0x0d &&   // CR
        bytes[5] === 0x0a &&   // LF
        bytes[6] === 0x1a &&   // SUB
        bytes[7] === 0x0a      // LF
    ) {
        return bytes;
    }
    console.warn('[ElpxExporter] Screenshot data is not a valid PNG');
    return null;
}
```

The eight bytes `89 50 4E 47 0D 0A 1A 0A` are the standard PNG file signature defined in the PNG specification (ISO/IEC 15948). Any data that does not begin with these bytes is silently rejected — `decodeScreenshotToBuffer` returns `null` and no `screenshot.png` is written to the ZIP.

There is no enforced upper limit on file size beyond what the ZIP library and browser memory allow. Practical guidance: keep screenshots under 500 KB for responsive performance in LMS thumbnail views.

### 3.3 Recommended dimensions

**1280 × 720 pixels** (16:9 aspect ratio). This matches the dimensions cited in the hub doc (`elpx-format.md:54`) and aligns with common LMS thumbnail requirements.

Smaller dimensions are accepted; the exporter does not resize or validate dimensions. Images with non-16:9 ratios will be displayed with letterboxing or cropping depending on the consuming tool.

---

## 4. Input format — base64 data URL

The exporter receives the screenshot as a **`data:image/png;base64,…` data URL** stored in the Yjs `metadata` Y.Map under the key `'screenshot'`.

`decodeScreenshotToBuffer()` strips the data URL prefix before decoding:

```typescript
let base64Data = screenshot;
if (base64Data.startsWith('data:')) {
    const commaIndex = base64Data.indexOf(',');
    if (commaIndex === -1) return null;
    base64Data = base64Data.substring(commaIndex + 1);
}
const binaryString = atob(base64Data);
```

Raw base64 strings (without the `data:` prefix) are also accepted by the same code path.

---

## 5. Two generation paths

### 5.1 Custom screenshot from project metadata (priority 1)

If `meta.screenshot` is set (a `data:image/png;base64,…` string from the Yjs metadata), it is used as the screenshot without modification (`ElpxExporter.ts:368`):

```typescript
if (meta.screenshot) {
    screenshotBuffer = this.decodeScreenshotToBuffer(meta.screenshot);
}
```

This is the path taken when the user has explicitly set a screenshot via the project properties dialog.

### 5.2 Auto-generate from first page HTML (priority 2)

If no custom screenshot is set, the exporter checks for an `options.generateScreenshot` async hook (`ElpxExporter.ts:372`):

```typescript
if (!screenshotBuffer && options?.generateScreenshot) {
    try {
        const firstPageHtml = pageHtmlMap.get('index.html');
        if (firstPageHtml) {
            const dataUrl = await options.generateScreenshot(firstPageHtml);
            if (dataUrl) {
                screenshotBuffer = this.decodeScreenshotToBuffer(dataUrl);
            }
        }
    } catch (error) {
        console.warn('[ElpxExporter] Screenshot auto-generation failed:', error);
    }
}
```

`generateScreenshot(html: string): Promise<string | null>` is an optional async callback provided by the caller (the Electron desktop app or the browser export flow). It receives the fully-rendered HTML of `index.html` and returns a `data:image/png;base64,…` data URL, or `null` on failure.

In the **Electron** desktop build, this hook uses an off-screen renderer to capture the first page at 1280×720 and returns the resulting PNG.

In the **browser** export flow, the hook may use an `<html2canvas>` or similar approach; if no hook is provided, auto-generation is skipped.

### 5.3 Omitted when neither path produces a result

If both `meta.screenshot` is absent and `generateScreenshot` is not provided (or returns `null`), no `screenshot.png` is written to the ZIP (`ElpxExporter.ts:385`):

```typescript
if (screenshotBuffer) {
    this.zip.addFile('screenshot.png', screenshotBuffer);
}
```

The importer tolerates the absence — `screenshot.png` is not strictly required to round-trip a project — but for v4 deliverables you should always patch in a thumbnail before publishing. Use [§5.4](#54-generated-placeholder-via-add-screenshotts) to add one to a legacy package.

### 5.4 Generated placeholder via `add-screenshot.ts`

For round-tripped legacy fixtures and any package that arrives without a screenshot, the repo ships [`scripts/add-screenshot.ts`](../../scripts/add-screenshot.ts). It produces a 1280×720 PNG with the project title (read from `<key>pp_title</key>` in `content.xml`) on a brand-coloured background and inserts it at the ZIP root.

```bash
# Add a screenshot in place
bun run scripts/add-screenshot.ts path/to/project.elpx

# Or write a copy with the screenshot patched in
bun run scripts/add-screenshot.ts in.elpx out.elpx

# Force regeneration even when one already exists
bun run scripts/add-screenshot.ts path/to/project.elpx --force
```

The script uses `@napi-rs/canvas` (already a project dependency) to render the title across up to three lines, with font size scaled to fit. It is the recommended way to bring older `.elpx` files (or files produced by stripped-down exporters) up to the v4 baseline without re-opening them in the editor.

---

## 6. Round-trip via Yjs metadata

### 6.1 Import side — `ElpxImporter.extractScreenshotFromZip()`

On import, `ElpxImporter` checks for `screenshot.png` at the archive root (`ElpxImporter.ts:866`):

```typescript
private extractScreenshotFromZip(zip: Record<string, Uint8Array>): string | undefined {
    if (!zip['screenshot.png']) return undefined;
    try {
        const base64 = this.uint8ArrayToBase64(zip['screenshot.png']);
        return `data:image/png;base64,${base64}`;
    } catch (error) {
        this.logger.warn('[ElpxImporter] Failed to read screenshot.png:', error);
        return undefined;
    }
}
```

The PNG bytes are base64-encoded and wrapped in a `data:image/png;base64,…` data URL. This data URL is stored in `metadataValues.screenshot` and subsequently written to the Yjs `metadata` Y.Map via `setMetadata()` (`ElpxImporter.ts:947`):

```typescript
if (values.screenshot) {
    metadata.set('screenshot', values.screenshot);
}
```

### 6.2 Absent screenshot on import

If `screenshot.png` is not present in the archive, `extractScreenshotFromZip` returns `undefined`. The `setMetadata` call omits the `screenshot` key, so the Yjs `metadata` Y.Map has no `'screenshot'` entry. The UI treats this as "no screenshot set" and displays a placeholder in the project properties dialog.

---

## 7. Distinction from `theme/screenshot.png`

These are two entirely separate files with different purposes:

| Property | `screenshot.png` (archive root) | `theme/screenshot.png` |
|----------|--------------------------------|------------------------|
| What it shows | A preview of the **project content** | A preview of the **theme appearance** |
| Who creates it | The eXeLearning exporter (auto or custom) | The theme author |
| Set by | Project settings / auto-capture hook | Shipped with the theme source files |
| Extracted by | `ElpxImporter.extractScreenshotFromZip()` | Theme picker UI |
| Stored in Yjs | `metadata.screenshot` | Not stored in Yjs; only read for display |
| Present in all exports | Yes for v4 (always emitted by the exporter; legacy packages can be patched with [`scripts/add-screenshot.ts`](../../scripts/add-screenshot.ts)) | Yes, whenever the theme is bundled |

The confusion is easy to make because both files are named `screenshot.png` and both are PNG images. The archive root file is always about the project; the `theme/` file is always about the theme's visual design.
