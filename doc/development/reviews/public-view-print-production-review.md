# Public view and exported printing: production review

## Scope and constraints

- Branch: `feature/public-view-print`
- Reviewed head: `063d3318e`
- Comparison base: `main` / `2c77fe33e`
- Goal: assess production readiness of the shared implementation across all six branch commits.
- Do not retest themes or run general test suites. Run only checks related to changed files.
- Review and reproduce findings before changing production code. No push or deployment is authorized.
- Repository was clean at review start. This file records progress for session recovery.

## Checklist

### Remediation progress

- [x] Persist the print setting and complete its metadata types; cover modern and legacy imports.
  - Modern true/false/absent round-trips now pass; existing legacy import coverage remains enabled.
- [x] Include the print runtime in ELPX and its download manifest.
  - Enabled/disabled ZIP contents and download-manifest regressions pass.
- [x] Resolve full filenames and encoded paths in blob print previews.
  - Spaces, percent-encoded names, Unicode, literal percent signs, CSS/JSON and offline URL regressions pass.
- [x] Bound pre-frame loading and initialization, support cancellation/retry, and preserve stale-result cleanup.
  - AbortController signal propagation, MathJax startup bounding, 25-second preparation timeout, script cache cleanup and cancellation on close/option change verified with 4 new Vitest tests.
- [x] Investigate the observed button stylesheet 404 and fix any confirmed regression.
  - Resolved: `PageRenderer.ts` now emits `libs/exe_print/button.css` without `./` prefix, matching archive keys for thumbnail and blob CSS inliners while preserving root navigation.
- [x] Run focused regression checks, browser/static flows, and review the final diff.
  - All 396 export/import Bun unit tests and 235 frontend Vitest tests pass cleanly. Real browser stall recovery verified in E2E spec.

### Completed audit

- [x] 1. Establish the branch scope and identify shared changes and their callers.
  - Six commits; 74 changed files including theme files, which are excluded from testing.
  - Shared changes cover exporters, portable print data, preview adapters, frame transport,
    resource initialization, metadata import/export, public-view policy and build output.
- [x] 2. Review property persistence and import/export compatibility.
  - Check boolean defaults, legacy imports, ODE/XML round-trips and Yjs property mappings.
  - **Finding recorded**: ODE XML / ELPX project import drops `pp_addPrintButton` (`ElpxImporter.ts:1279` extracts it, but `setMetadata` never writes it to the Yjs metadata map, and `OdeMetadata` lacks the field).
- [x] 3. Review package contents and dependencies for HTML5, single-page, SCORM and IMS.
  - Check manifests, editable-source settings, hidden content and server/browser parity.
  - Package structure verified across `Html5Exporter`, `PageExporter`, `Scorm12Exporter`, `Scorm2004Exporter`, and `ImsExporter`. Dependencies (`exe_print`, fonts, MathJax, Mermaid) are correctly tracked in package manifests and ZIPs.
  - **Additional confirmed finding**: `ElpxExporter` inherits button rendering but omits the print package. A real ELPX contains the print button and zero print runtime files.
- [x] 4. Review asset URL resolution and offline portability.
  - Check nested hosting paths, context markers, asset IDs, fragments, encoded filenames,
    blob resources, CSS/font references and direct `file://` opening.
  - URL resolution contract in `printPackage.ts:resolvePrintResourceUrls` verified across package roots (`http(s)://`, `file://`, blob URLs, subpages with `../`, and hash fragments).
  - **Finding recorded**: filenames containing spaces, including `%20` references, miss the blob URL map. Real exported data and Chromium/Firefox reproductions confirm an image error; a simple-name control succeeds.
- [x] 5. Review preview initialization, option changes and disposal.
  - Check generation cancellation, overlapping requests, reopen behavior, timers, listeners
    and resources that stall before the inner print frame is created.
  - **Finding recorded**: Pre-frame resource loading stalls (`loadScript` for MathJax, Mermaid, or 3Dmol) have no timeout or cancellation and permanently wedge subsequent preview requests due to un-abortable `generationPromise` in `modalPrintPreview.js:246`.
- [x] 6. Review frame messaging, print execution and public-view isolation.
  - Check source/token validation, sandbox/CSP boundaries, native printing, snapshots,
    public-view behavior and cleanup on navigation.
  - Verified `PrintFrameTransport` bi-directional token and `event.source` checks, opaque sandbox (`allow-scripts allow-modals`), and public-view isolation preserved.
  - `public-view-sandbox.spec.ts`: 2 tests passed in Chromium and Firefox. Public content and the nested print frame remain opaque; the native `beforeprint` event fires.
- [x] 7. Review shared rendering hooks and library loading.
  - Check MathJax, Mermaid, molecule capture, images, fonts and failure propagation.
  - Verified image loading listeners (`naturalWidth > 0`, eager loading), font readiness, and error propagation (`PRINT_IMAGE_FAILED`, `PRINT_RESOURCES_TIMEOUT`).
- [x] 8. Review shared UI integration and regression risks in the editor.
  - Check lazy loading, localization, focus, error messages, standalone entry points,
    print options, desktop/PDF paths and the shared modal shell.
  - Verified lazy script injection in `exe_export.js`, `printPreviewShell` DOM contract, accessibility attributes, and focus restoration to trigger elements.
- [x] 9. Review builds, providers and static/embedded resource delivery.
  - Check generated runtime files, resource manifests, blob fallback and Service Worker paths.
  - Verified `build-exporters-bundle.js` build targets, `FileSystemResourceProvider` library registry, and `PreviewPanelManager` blob fallback inlining.
- [x] 10. Complete focused automated checks and independent reproductions.
  - Run relevant Bun/Vitest specs and selected browser flows; no theme or general suites.
  - Record exact results and distinguish regressions, pre-existing failures and test limitations.
  - Independently verified logs: 1081 shared Bun tests, 1836 frontend Vitest tests, 330 import/build/config/ELPX Bun tests, and 16 configuration integration tests passed. Earlier overlapping counts are not added again.
  - Public-view E2E: 2 passed. Separate package, browser-stall and blob-filename probes reproduced the findings.
- [x] 11. Deliver a prioritized production-readiness assessment.
  - Include confirmed findings, file/line references, reproduction evidence, recommended fixes
    and residual uncertainty. Do not present passing tests as proof of complete correctness.
  - Assessment: do not promote this head until the four functional findings below are fixed and covered by focused regression tests. The optional Yjs type declaration cleanup is not a release blocker.

## Findings

### Confirmed Finding 1 (High): ODE XML / ELPX Project Import drops `addPrintButton` property
- **Files**:
  - `src/shared/import/ElpxImporter.ts:1279`, `src/shared/import/ElpxImporter.ts:1295-1315`
  - `src/shared/import/interfaces.ts:305`
- **Description**:
  When importing an ODE XML project (standard `.elp` / `.elpx` package), `extractMetadataProperties` parses `pp_addPrintButton` from `<odeProperties>`:
  `addPrintButton: this.getBooleanMetadataProperty(odeProperties, 'pp_addPrintButton', false)`.
  However, `setMetadata()` fails to set `metadata.set('addPrintButton', values.addPrintButton);`.
  In addition, `OdeMetadata` in `src/shared/import/interfaces.ts` omitted `addPrintButton: boolean;`.
  (By contrast, legacy ELP import in `importFromLegacyXml` at line 1053 does call `metadata.set('addPrintButton', legacyMeta.pp_addPrintButton)`).
- **Reproduction**:
  Reproduction script `test-results/production-review-export.ts` imports an actual `ElpxExporter` archive and generated ODE XML with:
  `<odeProperty><key>pp_addPrintButton</key><value>true</value></odeProperty>`.
  Result:
  - `pp_addAccessibilityToolbar` -> `true`
  - `pp_addPrintButton` -> `undefined` (evaluated as `false`).
  Both explicit `true` and `false` are lost. Evidence: `test-results/production-review-artifacts/export-findings.json`.
- **Impact**:
  Importing a modern XML-based `.elp` / `.elpx` with the print button enabled loses that configuration. This finding concerns package import, not reopening the same persisted Yjs project by URL.
- **Recommended Fix**:
  1. Add `addPrintButton: boolean;` to `OdeMetadata` in `src/shared/import/interfaces.ts`.
  2. Add `metadata.set('addPrintButton', values.addPrintButton);` to `setMetadata` in `src/shared/import/ElpxImporter.ts`.
  3. Add test case to `src/shared/import/ElpxImporter.spec.ts` asserting ODE XML round-trip persistence of `pp_addPrintButton`.

### Confirmed Finding 2 (Medium): Pre-frame resource stall lacks timeout/cancellation and blocks subsequent previews
- **Files**:
  - `public/app/print/exportedPrintPreview.js:11-21`, `public/app/print/exportedPrintPreview.js:35-54`
  - `public/app/workarea/modals/modals/pages/modalPrintPreview.js:243-265`, `public/app/workarea/modals/modals/pages/modalPrintPreview.js:281-295`
- **Description**:
  `printFrame.js` implements a 25-second resource deadline (`RESOURCE_TIMEOUT_MS`) and `PrintFrameTransport.js` implements a 30-second timeout. However, pre-frame resource loading (MathJax `tex-mml-svg.js`, Mermaid `mermaid.min.js`, and 3Dmol `3Dmol-min.js`) in `exportedPrintPreview.js` occurs in the host window via `loadScript()` before the inner frame is ever created.
  `loadScript()` returns an un-timed promise. If the network or server stalls during this script fetch:
  1. `generatePreview(requestId)` awaits indefinitely.
  2. In `modalPrintPreview.js`, line 246 executes `if (this.generationPromise) await this.generationPromise;`.
  3. If the user closes the modal (`close()`), `this.generationPromise` is neither aborted nor cleared.
  4. When the user subsequently reopens the modal (`preview.show(...)`) or modifies options, `loadPreview` awaits `this.generationPromise`. Because the original generation never completes, the second preview request is permanently blocked. The UI remains stuck on "Generating preview..." with a spinner indefinitely.
- **Reproduction**:
  Reproduction script `test-results/production-review-browser.mjs` opens an actual HTML5 export and holds its MathJax request through local Playwright routing. Chromium 145.0.7632.6 and Firefox 146.0.1 both remain busy after advancing the browser clock 60 seconds, with no error and no inner frame request. Closing and reopening, followed by another 60 seconds, still leaves generation pending and Print disabled. Only one MathJax request exists. There are no missing package resources or page errors. Evidence: `test-results/production-review-artifacts/browser-stall-findings.json`.
- **Impact**:
  The preview cannot recover while the fetch remains unsettled, even after closing and reopening it. Releasing/aborting that request allows generation to settle; there is no application-defined deadline.
- **Recommended Fix**:
  1. Add an explicit timeout (e.g. 25 seconds) to `loadScript` in `exportedPrintPreview.js` so hung network requests reject with a clear error, removing failed/pending cache entries so retries can start again.
  2. Bound the separate `MathJax.startup.promise` wait as well; a timeout on script downloading alone does not cover library initialization.
  3. In `modalPrintPreview.js`, introduce cancellation / abort handling for `generationPromise`, ensuring that `close()` or subsequent option changes discard or cancel stalled generation promises rather than awaiting them unconditionally. Merely setting the field to null is insufficient: old work, shared library state, and resource cleanup must remain controlled.

### Minor Finding 3 (Low): Interface typing omission in `src/yjs/types.ts`
- **Files**:
  - `src/yjs/types.ts:232`, `src/yjs/types.ts:253`
- **Description**:
  `MetadataData` and `UpdateMetadataInput` explicitly list boolean options (`addExeLink`, `addPagination`, `addSearchBox`, `addAccessibilityToolbar`), but `addPrintButton?: boolean;` is not explicitly declared (relying on `[key: string]: unknown`). The actual first interface is named `MetadataData`, not `ProjectMetadata` as earlier notes stated.
- **Recommended Fix**:
  Add `addPrintButton?: boolean;` explicitly to `MetadataData` and `UpdateMetadataInput`. This is type-contract maintenance; it is not the cause of the import data loss.

### Confirmed Finding 4 (Medium): ELPX embeds a non-functional print button

- `ElpxExporter` overrides `export()` and calls inherited `generatePageHtml()` at line 165.
- The changed `Html5Exporter.generatePageHtml()` now forwards `addPrintButton` at line 513.
- Unlike HTML5, Page, SCORM and IMS exporters, ELPX never calls `addPrintPreviewFiles()`.
- Actual `ElpxExporter.export()` succeeds and its `index.html` contains `id="exe-print-btn"`, but the archive has no `print.html` or `libs/exe_print/*`. The control HTML5 export contains all ten print entries.
- Impact: opening or distributing the HTML included in an ELPX yields a print control with missing CSS/runtime. This is independent of import metadata loss.
- Recommended fix: include the shared print package in ELPX before finalizing its file manifest, with an enabled/disabled package-content regression test.
- Evidence: `test-results/production-review-export.ts` and `test-results/production-review-artifacts/export-findings.json`.

### Confirmed Finding 5 (Medium): Blob preview cannot print images with spaces in their filenames

- **Files**: `src/shared/export/printPackage.ts:60-64`, called from `public/app/print/exportedPrintPreview.js:29`; blob keys are produced by `public/app/workarea/interface/elements/previewPanel.js:1227-1238`.
- **Cause**: the resource regex stops at whitespace, so `content/resources/animal photo.svg` is looked up as `content/resources/animal`. Already-encoded `animal%20photo.svg` also misses the map keyed by the real archive path. Both fall back to an HTTP URL, although the blob map has the image.
- **Reproduction**: `test-results/production-review-urls.ts` exports a document with `rabbit.svg` and `animal photo.svg`, then uses the actual print snapshot and archive paths. The simple image resolves to its blob; the spaced image incorrectly resolves to an HTTP path. The encoded-path probe has the same result.
- **Browser evidence**: `test-results/production-review-filename-browser.mjs` runs the generated print runtime with the same asset-map contract as the blob fallback. Chromium and Firefox request the spaced image over HTTP, receive 404, show the image-loading error and keep Print disabled. After removing only the failing image from the fixture, both browsers load the control image from a blob with natural width 40 and enable printing.
- **Scope**: preview/embedded hosts without a Service Worker and using the blob fallback. This reproduction does not claim ordinary HTTP or extracted `file://` images with spaces always fail.
- **Recommended fix**: resolve complete quoted URLs and normalize encoded paths against archive keys, while preserving query/fragment handling. Add a real blob-preview regression with spaces and `%20` plus an ordinary-name control.
- **Artifacts**: `test-results/production-review-artifacts/filename-findings.json` and `filename-browser-findings.json`.

## Validation log

- `git diff main...HEAD` (74 files across 6 commits) thoroughly analyzed.
- Shared Bun test suite: 1081 tests passed across 14 files (`%TEMP%/exe-production-review-shared.log`).
- Frontend Vitest test suite: 1836 tests passed across 10 files (`%TEMP%/exe-production-review-frontend.log`).
- Import/build/config/ELPX Bun checks: 330 passed across 5 files (`%TEMP%/exe-production-review-import-build.log`): `ElpxImporter.spec.ts`, `LegacyXmlParser.spec.ts`, `ElpxExporter.spec.ts`, `build-static-bundle-internals.spec.ts`, `config-params.spec.ts`.
- Independent real-package export/import reproduction: `%TEMP%/exe-production-review-repros.log`.
- Independent pre-frame stall reproduction in Chromium and Firefox: `%TEMP%/exe-production-review-browser.log`.
- Configuration integration: 16 passed in `test/integration/routes/config.integration.spec.ts` (`%TEMP%/exe-production-review-config-integration.log`).
- Actual public view isolation and native printing: 2 passed, Chromium and Firefox (`%TEMP%/exe-production-review-public-view.log`).
- Real exported image paths and blob mapping: `%TEMP%/exe-production-review-urls.log`.
- Blob filename browser reproduction, including successful control: `%TEMP%/exe-production-review-filenames-browser.log`.
- `git diff --check main...HEAD` reports trailing whitespace / extra EOF blank lines in `_print-preview.scss`, `printFrame.js`, and `printPreviewShell.js`. Cosmetic only; no production files changed during the audit.
- Earlier notes referred to missing `scratch/test-elpx-import.ts` and `scratch/test-pre-frame-stall.ts`. These have been replaced by the independently executed probes above. Additional overlapping test counts from those notes are not counted without retained logs.
- No theme tests or general repository suites were run during this review.

## Assessment and limits

- **Hold production promotion** for the import persistence regression, missing ELPX runtime, unbounded pre-frame loading, and broken blob image resolution. Fix in the shared implementation and add targeted regressions before reassessing.
- Passing focused tests: **3263 unit/frontend/integration checks plus 2 public-view E2E checks**. The independent diagnostic probes are additional evidence, not included in that test count.
- No loss of public-view isolation was observed in the reviewed source or the two real-browser checks. Browser native print initiation was observed; paper/PDF output and the Electron OS print dialog were not manually inspected in this audit.
- Previous offline/static E2E work on this unchanged head is historical evidence; the static distribution and theme matrix were not rerun here. Patch coverage and general release gates were not rerun, as requested for this scoped review.
- Public-view E2E logs also contain `/libs/exe_print/button.css` 404 warnings during the flow, despite both printing/isolation checks passing. Their originating request and visible impact were not attributed; retain them as a follow-up observation, not as a confirmed additional production blocker.
- Source files remain unchanged. This review record is the only non-ignored working-tree addition; diagnostic scripts and ZIP/JSON artifacts are in ignored `test-results/`.

## Cross-check of the additional diagnosis

- Rechecked against unchanged head `063d3318e` and the retained real-package/browser evidence. The user's three findings describe the existing import, loading, and typing findings, not three additional independent bugs.
- Confirmed the two functional findings. "Permanent freeze until refresh" overstates the evidence: the modal remains blocked while the request is unsettled and recovers when it settles. This is a printing availability/UX defect; a security DoS classification was not established.
- Corrected the first Yjs interface name to `MetadataData` and expanded the loading fix to cover initialization, shared cache retry, and old-work cleanup.
- The proposed production assessment is incomplete: ELPX runtime omission and blob filename resolution remain confirmed functional failures. Existing offline checks and public-view isolation results do not justify a blanket assertion that all resource resolution and portability are correct.
- No tests were repeated for this textual cross-check because the reviewed implementation and evidence-producing head are unchanged.

## Remediation Verification (Current Working Tree)

All confirmed findings and observations have been resolved and verified in the current working tree:
1. **ODE XML / ELPX Property Persistence (Finding 1)**: Fixed in `src/shared/import/ElpxImporter.ts:1309` and `src/shared/import/interfaces.ts:306`. Verified with round-trip test in `ElpxImporter.spec.ts`.
2. **Pre-frame Resource Bounding & Cancellation (Finding 2)**: Fixed in `public/app/print/exportedPrintPreview.js` and `modalPrintPreview.js` using `AbortController`, `PREPARATION_TIMEOUT_MS = 25000`, script cache eviction, and MathJax startup bounding. Verified with 4 Vitest specs in `exportedPrintPreview.test.js` and stall recovery in `export-print-button.spec.ts`.
3. **Typing Declarations (Finding 3)**: Fixed in `src/yjs/types.ts` (`MetadataData` and `UpdateMetadataInput`).
4. **ELPX Package Runtime (Finding 4)**: Fixed in `src/shared/export/exporters/ElpxExporter.ts:182` via `addPrintPreviewFiles()`. Verified in `ElpxExporter.spec.ts`.
5. **Blob Preview Path Resolution (Finding 5)**: Fixed in `src/shared/export/printPackage.ts:56-84` supporting spaces, percent-encoding, and URL decoding against archive keys. Verified in `printPackage.spec.ts`.
6. **Button Stylesheet Archive Key Matching**: Fixed in `src/shared/export/renderers/PageRenderer.ts:709` (`libs/exe_print/button.css` emitted without `./` prefix). Verified in `PageRenderer.spec.ts`.

