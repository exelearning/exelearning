# Assets in ELPX Packages

This document covers how project assets (images, audio, video, PDFs, and other binary files) flow through the export/import pipeline: the URL forms an asset reference takes, the export and import transformations that convert between them, and how assets are placed inside the ZIP archive and on the server filesystem.

> **See also**: [ELPX Format hub](../elpx-format.md) | [Themes](themes.md) | [Libraries](libraries.md) | [Screenshot](screenshot.md)

---

## 1. Asset URL lifecycle — three forms

An asset reference passes through three distinct URL forms depending on where it appears.

### 1.1 Yjs internal form — `asset://<uuid>`

While a project is open in the editor, every asset reference in iDevice content is stored in the Yjs Y.Doc as an `asset://` URL:

```
asset://3f7a1b2c-4d5e-6f78-9a0b-1c2d3e4f5678
asset://3f7a1b2c-4d5e-6f78-9a0b-1c2d3e4f5678.jpg
```

Two sub-formats exist:

- `asset://<36-char-uuid>` — UUID without extension (older format).
- `asset://<36-char-uuid>.<ext>` — UUID with file extension appended (current format).

The UUID identifies an entry in the Yjs `assets` Y.Map, which holds the asset's binary data, MIME type, and original filename.

### 1.2 XML export form — `{{context_path}}/<exportPath>`

When content is serialised to `content.xml` (inside `<htmlView>` and `<jsonProperties>` CDATA blocks), `asset://` references are rewritten to a path-template form that points at the resources directory:

```
{{context_path}}/my-image.jpg                 # asset at content/resources/
{{context_path}}/photos/vacation/sunset.jpg   # asset inside a user-created folder
{{context_path}}/lecture-slides.pdf
```

`{{context_path}}` is a placeholder that is resolved at render time to a relative prefix that — combined with the export path — locates the asset under `content/resources/<exportPath>`. The placeholder absorbs both the page-depth `../` and the `content/resources/` segment, so the XML body itself carries only the export path (filename, optionally prefixed by the asset's `folderPath`).

> **Folders are first-class.** The eXeLearning file-manager UI lets authors organise assets into nested folders. Each asset record stores its `folderPath` (`src/shared/export/interfaces.ts:289`), and `BaseExporter.addAssetsToZipWithResourcePath()` (`BaseExporter.ts:429`) preserves it on every export by writing the file to `content/resources/<folderPath>/<filename>`. The XML reference in turn becomes `{{context_path}}/<folderPath>/<filename>`. Don't assume assets are always at the root of `content/resources/`.

> **Compatibility note**: an older long form, `{{context_path}}/content/resources/<exportPath>`, also works because the export pipeline writes assets to the same location. New exports use the short form; importers accept both. See [§3 Import pipeline](#3-import-pipeline).

### 1.3 Final HTML form — resolved relative path

When individual HTML pages are generated, `{{context_path}}` is replaced with the prefix that, when prepended to the filename, yields a valid relative path back to the asset on disk. For an asset stored at `content/resources/my-image.jpg` inside the ZIP, the substitution gives:

```
# index.html (at ZIP root) — {{context_path}} → content/resources
content/resources/my-image.jpg

# html/page-title.html (one level deep) — {{context_path}} → ../content/resources
../content/resources/my-image.jpg
```

The page renderer (`Html5Exporter.generatePageHtml()`, `Html5Exporter.ts:393`) computes the depth-based prefix and substitutes the placeholder inline.

---

## 2. Export pipeline

### 2.1 `BaseExporter.addFilenamesToAssetUrls()` — `asset://` to `{{context_path}}`

The primary transformation happens in `BaseExporter.addFilenamesToAssetUrls()` (`src/shared/export/exporters/BaseExporter.ts:647`).

This method is called during `preprocessPagesForExport()` on every `component.content` string and every serialised `jsonProperties` object before any HTML rendering occurs. It iterates the Yjs `assets` Y.Map to build a `Map<uuid, exportFilename>` (`buildAssetExportPathMap()`) and then rewrites every `asset://` URL it finds. The output is the placeholder-templated form described above.

The `OdeXmlGenerator.transformAssetUrlsForXml()` function (`OdeXmlGenerator.ts:251`) is intentionally a no-op since v4: by the time the generator runs, every `asset://` reference has already been replaced by the preprocessing step.

### 2.2 ZIP placement — `content/resources/<folderPath>/<filename>`

Assets are written into the ZIP by `BaseExporter.addAssetsToZipWithResourcePath()` (`BaseExporter.ts:429`). Each asset lands under `content/resources/` at the export path computed from its `folderPath` and `filename`. Two layouts are valid:

```
# Asset with no folderPath (root of content/resources/)
content/resources/my-image.jpg
content/resources/lecture-slides.pdf

# Assets inside user-created folders (folderPath preserved verbatim)
content/resources/photos/cover.jpg
content/resources/photos/vacation/sunset.jpg
content/resources/handouts/lesson-1/slides.pdf
```

`folderPath` is preserved by every export. There is **no per-asset UUID subfolder** in the v4 layout — that pattern was a v3-era artefact (one `content/resources/<UUID>/<filename>` directory per asset, named after an ODE identifier `[0-9]{14}[A-Z0-9]{6}`). v3-style packages are normalised by the [`scripts/flatten-elpx.ts`](../../scripts/flatten-elpx.ts) tool, which:

1. Walks every `content/resources/<segment>/...` entry where `<segment>` matches the ODE-ID regex `^[0-9]{14}[A-Z0-9]{6}$`. **User-organised folders never match this pattern and are therefore preserved untouched.**
2. SHA-256-hashes contents, deduplicates byte-identical files, and resolves name collisions with `_2`, `_3` suffixes (suffix is appended to the basename, the directory portion stays in place).
3. Rewrites the references inside `content.xml`, `index.html`, and `html/*.html` to match.

Run `bun run scripts/flatten-elpx.ts <input.elpx>` to flatten in place. The script is a no-op when no UUID-pattern folders are present, so it is safe to run on already-clean v4 packages.

### 2.3 `{{context_path}}` resolution during HTML rendering

For each rendered HTML page, the page renderer computes a base prefix:

| Page | Depth | `{{context_path}}` resolves to |
|------|-------|--------------------------------|
| `index.html` | ZIP root | `content/resources` |
| `html/<slug>.html` | one level deep | `../content/resources` |

The substitution is applied to every occurrence of the placeholder in the page body, including `<img src>`, `<a href>`, `<video src>`, `<source src>`, and similar attributes, and to JSON payloads embedded inside `<script type="application/json">` tags.

---

## 3. Import pipeline

On import, `ElpxImporter` reads all iDevice content from `content.xml` and passes strings through `assetHandler.convertContextPathToAssetRefs()`.

The method is invoked in two places:

1. **HTML content** (`ElpxImporter.ts:738`): after building each iDevice's `htmlView`, any `{{context_path}}/<filename>` (or legacy `{{context_path}}/content/resources/<filename>`) pattern is converted back to `asset://<uuid>`.
2. **JSON properties** (`ElpxImporter.ts:1866`): `convertAssetPathsInObject()` recursively walks the properties object. For strings containing `{{context_path}}`, it calls `convertContextPathToAssetRefs()`; for strings starting with `resources/` (legacy non-templated paths), it calls `findAssetUrlForPath()`.

The asset handler maps filenames back to their UUIDs using `this.assetMap`, which is built by extracting all files from the `content/resources/` directory inside the ZIP and registering them as new assets in the Yjs document.

The resulting Yjs document stores only `asset://` URLs — no ZIP-relative paths leak into the editing state.

---

## 4. ZIP placement summary

```
project.elpx (ZIP)
└── content/
    └── resources/
        ├── photo.jpg                    # asset with no folderPath (lives at root of resources)
        ├── slides.pdf
        ├── audio.mp3
        ├── photos/                      # user-created folder (folderPath="photos")
        │   ├── group-shot.jpg
        │   └── vacation/                # nested user folder (folderPath="photos/vacation")
        │       └── sunset.jpg
        └── handouts/lesson-1/           # any user folder depth is permitted
            └── exercises.pdf
```

What you will **not** see in a v4 archive:

- `content/resources/<14-digit-timestamp><6-char-suffix>/<filename>` — that is the legacy v3 per-asset UUID subfolder, normalised by [`scripts/flatten-elpx.ts`](../../scripts/flatten-elpx.ts) on round-trip.

ZIP entries always use forward slashes (`/`) as path separators, regardless of the host operating system, in compliance with the ZIP specification.

---

## 5. Server-side asset storage

On the server, permanent project assets are stored at:

```
FILES_DIR/assets/<projectUuid>/
```

For example:

```
/mnt/data/assets/3f7a1b2c-4d5e-6f78-9a0b-1c2d3e4f5678/photo.jpg
```

`FILES_DIR` resolves in this priority order (from `AGENTS.md §7.3`):

1. `ELYSIA_FILES_DIR` environment variable (used in tests).
2. `FILES_DIR` from `.env`.
3. `./data/` (development fallback).

The project UUID (not the numeric project ID) is always used for the directory name. All code accessing assets must use `path.join()` to construct paths and must call `isPathSafe()` before any file I/O on user-supplied path components.

---

## 6. Permitted asset types and iDevice constraints

Any binary file type may be attached as a project asset. The exporter places it verbatim under `content/resources/` without type checking.

Individual iDevices impose their own constraints at the UI level:

| iDevice | Typical asset types | Notes |
|---------|--------------------|-------|
| Image | `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.webp` | Raster preferred for lightbox; SVG supported |
| Image gallery | `.jpg`, `.jpeg`, `.png` | Multiple images per iDevice |
| Image magnifier | `.jpg`, `.jpeg`, `.png` | High-resolution raster recommended |
| Audio / Video | `.mp3`, `.ogg`, `.mp4`, `.webm` | URLs (YouTube/Vimeo/MP4) also accepted; file assets for local media |
| Interactive video | Video URL or `.mp4` | YouTube, Vimeo, and direct MP4 links |
| Download source file | Any binary | Typically the project `.elpx` itself or a ZIP bundle; triggers `elpx-manifest.js` generation |
| PDF viewer | `.pdf` | Embedded via browser native PDF viewer or PDF.js |
| File download | Any binary | Presented as a download link |

---

## 7. Cross-platform path rules

- Always construct filesystem paths with `path.join()`. Never concatenate strings with `\\` or `/`.
- ZIP archive entries use `/` separators unconditionally (ZIP spec requirement).
- Asset filenames in `content/resources/` are derived from the original upload filename. The exporter sanitises filenames to remove characters that are invalid on Windows and macOS.
- Duplicate filenames are resolved either by appending a counter suffix before the extension (during export) or by the [`flatten-elpx.ts`](../../scripts/flatten-elpx.ts) deduplication pass (when normalising legacy packages).
