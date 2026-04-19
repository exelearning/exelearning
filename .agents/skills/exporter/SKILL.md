---
name: exporter
description: Adding or modifying export formats (HTML5, SCORM, EPUB3, IMS-CP) in src/shared/export/. Every change must ship with colocated `*.spec.ts` tests validating the generated ZIP structure and manifests, keep patch coverage ≥ 90% on changed lines, include or update a Playwright spec exercising both browser-side and server-side export paths, and pass `make fix`, `make test-unit`, `make test-integration`, `make test-e2e`, and `make test-e2e-static` before submission.
---

# Skill: Exporter

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [backend-service](../backend-service/SKILL.md), [idevice](../idevice/SKILL.md)

## When to Use

Adding or modifying export formats in `src/shared/export/`.

## Key Files

- `src/shared/export/exporters/BaseExporter.ts` — abstract base class (extend this)
- `src/shared/export/exporters/Html5Exporter.ts` — reference implementation
- `src/shared/export/exporters/*.ts` — Html5, Scorm12, Scorm2004, Ims, Epub3, Elpx, Component, Page, PrintPreview
- `src/shared/export/renderers/` — `PageRenderer.ts`, `IdeviceRenderer.ts`
- `src/shared/export/generators/` — `OdeXmlGenerator.ts`, manifest generators, `LomMetadata.ts`, `I18nGenerator.ts`
- `src/shared/export/providers/` — asset and resource providers
- `src/shared/export/adapters/` — `YjsDocumentAdapter.ts`, `BrowserAssetProvider.ts`, `ExportAssetResolver.ts`
- `src/shared/export/browser/` — browser-side shims for shared code
- `src/shared/export/utils/` — `LibraryDetector.ts`, `GlobalFontGenerator.ts`
- `public/preview-sw.js` — Service Worker for preview

## Architecture

```
Browser (primary path)                    Server (CLI/API only)
─────────────────────                     ─────────────────────
SharedExporters → ZIP in memory           POST /api/export/:sessionId/:type
 → download (web) / save (Electron)       → Y.Doc from DB → exporters → ZIP → stream
```

The **primary export path is browser-side**. Server-side export exists only for CLI commands and the external API.

- `generateForPreview()` — generates files in memory, sends to Service Worker via `postMessage`
- `generate()` — full export with ZIP creation

## Memory Considerations

Large projects (150MB+) can cause OOM during export. Key patterns (_example: PR #1527_):

- **Chunked base64 conversion** — never convert large blobs to base64 in one shot.
- **Sequential asset processing** — process assets one at a time, not all in parallel.
- **Metadata-only listing** — use lightweight metadata APIs instead of loading full asset content.

Use the built-in profiling flags to diagnose issues before adding ad-hoc logging:

```javascript
window.eXeLearning.config.debugElpxExport = true;
// After export: window.__lastElpxExportSummary
```

## Commands

```bash
bun test src/shared/export/exporters/MyExporter.spec.ts     # Single test
bun test src/shared/export/                                  # All export tests
make fix                                                     # Lint
```

## Gotchas

- **Browser-first architecture** — the exporter must work in the browser. Server-side is the secondary path.
- **JSZip for extraction, Archiver for creation** — don't mix them up. Always check `zipEntry.dir` before reading content.
- **Test both `generate()` and `generateForPreview()`** — they have different code paths (ZIP vs in-memory files).
- **Browser adapter required** — if your exporter needs browser APIs, create a shim in `src/shared/export/browser/`.
- **IdeviceRenderer wrapper divs** — `<div class="exe-text">` wrappers accumulate on re-import. Normalize during import, not during export. _Example: PR #1559._
- **Library detection** — if the exported content uses MathJax or other libraries, `LibraryDetector` must find them. Tests should verify no 404s for library resources.
- **Preview resource loading** — preview must not tolerate missing resources. MathJax loads from `/app/common/exe_math/tex-mml-svg.js` (bypasses the Service Worker when `addMathJax: true`). Other libraries are detected by `LibraryDetector`, fetched by `ResourceFetcher`, and served by the Service Worker. Verify no 404s in preview flows when touching export or resource detection.

## Done When

- [ ] Extends `BaseExporter`
- [ ] `.spec.ts` colocated and passing at 90%+ coverage
- [ ] Both `generate()` and `generateForPreview()` tested
- [ ] Browser adapter created if needed (`src/shared/export/browser/`)
- [ ] Large-file scenario considered (no O(n^2) conversions)
- [ ] `make fix` passes clean
