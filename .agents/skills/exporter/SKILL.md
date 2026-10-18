---
name: exporter
description: "Change shared eXeLearning export formats, preview generation, ZIP/resource providers or import/export round-trips."
---

# Shared exporters and preview

Read `src/shared/export/exporters/`, `renderers/`, `generators/`, `providers/`, `adapters/`, and
`public/preview-sw.js`. Start with the affected exporter and provider; reuse BaseExporter when adding a format.

- UI export tries browser-side first (`SharedExporters` builds the ZIP in memory; Electron saves it to
  disk). The server fallback (`/api/export/:odeSessionId/:exportType/download`) rebuilds a Y.Doc from the
  database, writes to `dist/` and streams it back; CLI commands and the external API use it too.
  Do not remove a server path merely because browser editing is primary.
- ELP packages contain `content.xml` or legacy `contentv3.xml` (pre-v3.0). `ElpxImporter` hands legacy
  files to `LegacyXmlParser` (`src/shared/import/`); keep legacy imports working client-side.
- `FflateZipProvider` is the current shared ZIP implementation. Older instructions naming Archiver and
  JSZip providers are stale. Verify each import path's actual parser rather than globally swapping libraries.
- Test generated ZIP contents and manifests, not just successful promises. Preserve relative asset URLs,
  stable IDs, legacy ELP round-trips, metadata, library detection and format-specific tracking contracts.
- Preview generation differs from ZIP generation: `Html5Exporter.generateForPreview()` builds files in
  memory and posts them to `public/preview-sw.js`, which serves `/viewer/*` to the preview iframe.
  Check the real preview and downloaded output; avoid accepting resource 404s or relying on editor globals.
- Shared modules must remain browser-compatible. Use existing environment/resource/asset adapters rather
  than adding Bun/Node imports or inventing a new shim for every caller.
- Preserve sequential or bounded asset processing and metadata-only listings for large projects. Avoid
  materializing large blobs/base64 copies unnecessarily; measure with the existing profiling flags
  before adding ad-hoc logs: `window.eXeLearning.config.debugElpxExport = true` (then
  `window.__lastElpxExportSummary`/`__lastElpxExportTimeline`) and `debugSaveMemory = true` (then
  `window.__lastSaveMemorySummary`/`__lastSaveMemoryTimeline`).
- SCORM changes must preserve both the exported runtime and manifest contract; use independent package
  fixtures and LMS contract tests where present, not only assertions against the generator's own output.

Run affected Bun exporter/provider/renderer specs and relevant Vitest preview/import tests. For visible
export changes, add/update Playwright verification of browser output and the server/CLI path, plus static
E2E. Apply `verify-change` final gates. Read [profiling](../../../doc/development/profiling.md) for existing diagnostics.
