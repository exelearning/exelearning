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
  - AbortController signal propagation, MathJax startup bounding, 25-second preparation timeout, script cache cleanup and cancellation on close/option change pass focused Vitest checks. HTTP retries use a new query key so Chromium cannot coalesce them with a stalled request.
- [x] Investigate the observed button stylesheet 404 and fix any confirmed regression.
  - Resolved: `PageRenderer.ts` now emits `libs/exe_print/button.css` without `./` prefix, matching archive keys for thumbnail and blob CSS inliners while preserving root navigation.
- [x] Run focused regression checks, browser/static flows, and review the final diff.
  - Current focused results: 464 Bun tests across five files and 379 Vitest tests across three files passed. Two Bun tests initially hit their five-second limits while builds/Vitest coverage ran concurrently; rerunning the same five-file command alone passed all 464 without changing tests or timeouts.
  - Combined LCOV patch coverage: 115/115 changed executable lines (100%) relative to `063d3318e`. Adapter line coverage is 100%; modal line coverage is 98.53%.
  - The first browser run had five passes and one Chromium recovery failure because its bundle predated the HTTP retry adjustment. The rebuilt runtime now passes eight Chromium/Firefox E2E checks and three static E2E checks.

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

## Assessment and limits before remediation

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

## Remediation verification (current code)

The following fixes are implemented and the focused unit, DOM, browser and static verification has passed:
1. **ODE XML / ELPX Property Persistence (Finding 1)**: Fixed in `src/shared/import/ElpxImporter.ts:1309` and `src/shared/import/interfaces.ts:306`. Verified with round-trip test in `ElpxImporter.spec.ts`.
2. **Pre-frame resource bounding and cancellation (Finding 2)**: Fixed in `public/app/print/exportedPrintPreview.js` and `modalPrintPreview.js` using `AbortController`, `PREPARATION_TIMEOUT_MS = 25000`, script cache eviction, MathJax startup bounding and independent HTTP retries. Focused Vitest regressions and real-browser recovery now pass in Chromium, Firefox and the static distribution.
3. **Typing Declarations (Finding 3)**: Fixed in `src/yjs/types.ts` (`MetadataData` and `UpdateMetadataInput`).
4. **ELPX package runtime (Finding 4)**: Fixed in `src/shared/export/exporters/ElpxExporter.ts` via `addPrintPreviewFiles()`. ZIP contents and download-manifest enabled/disabled cases pass in `ElpxExporter.spec.ts`.
5. **Blob Preview Path Resolution (Finding 5)**: Fixed in `src/shared/export/printPackage.ts:56-84` supporting spaces, percent-encoding, and URL decoding against archive keys. Verified in `printPackage.spec.ts`.
6. **Button Stylesheet Archive Key Matching**: Fixed in `src/shared/export/renderers/PageRenderer.ts:709` (`libs/exe_print/button.css` emitted without `./` prefix). Verified in `PageRenderer.spec.ts`.

### Final retained results

- **Bun**: 464 passed, 0 failed across `ElpxImporter.spec.ts`, `LegacyXmlParser.spec.ts`, `ElpxExporter.spec.ts`, `printPackage.spec.ts` and `PageRenderer.spec.ts`. Log: `%TEMP%/exe-print-remediation-bun-final.log`.
- **Vitest**: 379 passed across `exportedPrintPreview.test.js`, `modalPrintPreview.test.js` and `previewPanel.test.js`. Log: `%TEMP%/exe-print-remediation-vitest-final.log`.
- **Patch coverage**: 115/115 executable changed lines covered (100%), calculated from Bun and Vitest LCOV against `063d3318e`. Artifact: `test-results/print-remediation-patch-coverage.json`.
- **Chromium/Firefox**: eight passed, covering enabled/disabled HTML5, Page and ELPX packages, preparation timeout/retry/cancellation, preview option changes, blob image loading with spaces, nested hosting paths, direct offline `file://` opening, and opaque public-view native print initiation. Log: `%TEMP%/exe-print-remediation-e2e-final.log`.
- **Static**: three passed for package generation, preparation recovery and the complete options/blob/offline flow. Log: `%TEMP%/exe-print-remediation-static-final.log`.
- **Builds**: current exporters/print runtime, interface, and static distribution built successfully. The import bundle was regenerated after the persistence fix.
- **Formatting/lint**: `make fix` passed; no fixes applied in the final run. Existing warnings remain. Log: `%TEMP%/exe-print-remediation-fix-final.log`.
- No theme matrix or general test suite was rerun, following the user's scope restriction. Physical paper/PDF output and Electron OS dialogs were not manually inspected.
- All previously confirmed functional findings are resolved within this scope. These focused results do not claim execution of the repository's complete release gates.

## General verification requested on 2026-10-25

Source revision: `b907fed51` (`feature/public-view-print`). This run expands the earlier focused verification to the general repository suites. Logs are retained in the Windows temporary directory as `exe-general-*.log`.

- [x] `make fix`: passed, no files changed; 44 existing warnings.
- [x] General Bun unit suite executed: 10,886 passed, 85 failed across 335 files (323.02 seconds). The full suite is not green; platform-specific failures are being classified separately at the user's request. Logs: `exe-general-unit.log`, `exe-coverage.txt`, `exe-general-unit-coverage.log`.
- [x] General frontend suite: 18,173 passed, 0 failed across 320 files (499.30 seconds). Line coverage: 88.76%. Command: `bun run test:frontend --maxWorkers=2` with the CI Node heap setting (6 GB). Log: `exe-general-frontend.log`.
- [x] General integration suite executed: 763 passed, 3 failed across 45 files (384.16 seconds). Two failures concern Windows test-directory cleanup; one is a five-second matrix-export hook timeout. Log: `exe-general-integration.log`.
- [x] Current static distribution built successfully from the freshly rebuilt application/exporter/importer bundles. Command: `bun scripts/build-static-bundle.ts`; log: `exe-general-static-build.log`.
- [x] General Chromium E2E suite executed: 794 passed, 10 failed, 11 pre-existing skips (815 cases; approximately one hour). Printing/options/offline tests passed. Log: `exe-general-chromium.log`; JSON: `test-results/general-chromium-report.json`; HTML: `playwright-report/general-chromium/`. Runtime source remains at `b907fed51`.
- [x] General Firefox E2E attempts reviewed, **not completed**: both four-worker and two-worker runs repeatedly failed while creating pages, before application assertions. Firefox is an environment limitation in this general run; neither partial attempt is reported as a passing full suite. Both attempts are archived separately; see triage below.
- [x] General static E2E suite executed: 675 passed, five failed, 150 pre-existing skips (830 cases; approximately 37 minutes), using a temporary Bun static server after Node `serve` crashed with `EMFILE`. The five failures match the confirmed CLI MathJax and preview-helper findings. Log: `exe-general-static.log`; JSON: `test-results/general-static-report.json`; HTML: `playwright-report/general-static/`.
- [x] Architecture records: passed (49 records, 10 changes).
- [x] Final corrective verification and working-tree checks completed; results and remaining release-gate limitations below.

Windows-only failures are recorded without changing application code or weakening tests, as explicitly requested by the user. General suites ran against `b907fed51`; the subsequent corrections and their focused verification are recorded separately below.

The full E2E run used four workers for Chromium/static (the repository's configured ceiling), separate JSON/HTML reports and unique artifact directories for each project. Firefox was attempted with four and two workers, then stopped after repeated browser-startup failures at both settings. The ignored `coverage/general-e2e-queue.ps1` has finished; durable progress and the incomplete Firefox status are in `coverage/general-e2e-state.json`. Completed reports are `test-results/general-<project>-report.json` and `playwright-report/general-<project>/`.

### General-run triage

- The shared printing/import/export unit cases passed in the general Bun run. Confirmed native-Windows failures include POSIX-vs-Windows separator assertions, Unix-only permission/shell assumptions, and `EBUSY` while deleting `migration-test.db`.
- The MathJax vendor check differs only in `public/app/common/exe_math/LICENSE`: the checked-out file has 202 CRLF line endings, while the npm file uses LF. Their normalized contents are identical. No vendor regeneration was performed.
- The general Bun run also hit the default five-second limit in the EPUB CLI export case. This is one timeout, repeated in Bun's failure summary. An isolated retry passed with the original limit: one test passed in 4,922 ms (`exe-general-epub-retry.log`).
- The raw unit coverage checker returned five below-threshold files: `redis/pubsub-manager.ts`, `routes/config.ts`, `routes/resources.ts`, `cli/commands/elp-convert.ts` and `websocket/yjs-persistence.ts`. Windows backslashes prevent existing POSIX exclusion entries from matching the first two. All five files are unchanged by this branch. This run does not claim a passing general backend coverage gate.
- Both integration cleanup failures are explained by the unchanged helper's `dir.includes('test/temp')` guard rejecting native Windows paths with backslashes (`test/integration/helpers/integration-app.ts:56`).
- The grading matrix timeout reproduced in isolation without changing the original limit (`exe-general-grading-retry.log`). Its `beforeAll` exports and writes five complete HTML5 packages before assertions run; the five-second setup limit is exceeded. The test, fixtures and scenario catalogue are unchanged by this branch. This remains a reported general-suite timeout, not a demonstrated printing assertion failure or a confirmed Windows-only defect.

### Confirmed branch regression during the general run

- Chromium's unchanged `idevices/3dmol-cli-export.spec.ts` reports a missing `libs/exe_math/tex-mml-svg.js` in an ordinary CLI HTML5 export.
- The changed `common.js` `updateLatex()` guard loads the engine whenever only its configuration exists, including targets containing no unrendered mathematics. Such exports intentionally omit MathJax when no runtime math is needed.
- Independent same-ZIP comparison confirms causality: the branch's `libs/common.js` requests the missing engine; replacing only that file in the browser route with `main:public/app/common/common.js` produces no missing requests. Both variants have zero page errors. Evidence: ignored `coverage/general-3dmol-diagnosis.cjs`, `coverage/general-3dmol-diagnosis.json` and `%TEMP%/exe-general-3dmol-diagnosis.log`.
- Corrected after the general suites: when the API is absent, inspect a cloned target and exclude `.exe-math-rendered` and `mjx-container` content before requesting MathJax. Raw LaTeX and native MathML still initialize the engine; plain text and rendered formulas do not. The original DOM is preserved. Nine new regression cases cover both paths; browser verification is recorded below.

### Preview test-helper incompatibility exposed by the general run

- Both Markdown preview failures stop before their feedback assertions: `waitForPreviewContent()` clicks `#head-bottom-preview` again after `openPreviewPanel()` has already opened the panel. The open panel header intercepts that second click for 20 seconds.
- This branch correctly makes `openPreviewPanel()` inspect the panel's `active` class, but the second helper still unconditionally clicks. Before this branch, the first helper's incorrect `isVisible()` check could leave opening to the second helper.
- Corrected after the general suites: `waitForPreviewContent()` reuses the idempotent `openPreviewPanel()` and preserves its article-ready check. The original Markdown failures never reached their content/feedback assertions; focused browser verification follows below.
- The final Chromium JSON report attributes both flipcard text-fit failures to the same blocked second preview click, before their text-fit assertions. This helper problem explains four of the ten Chromium failures, not only the two Markdown cases.

### Chromium failure classification

The ten recorded failures are block-arrow reordering (`#1667`), undoing component import, the confirmed unnecessary MathJax request in CLI 3DMol export, Download Source File property synchronization, the four confirmed preview-helper failures (two flipcard and two Markdown cases), TinyMCE HTML-source editing, and collaborative text remaining visible when a second user opens the editor. The other five cases all passed an isolated two-worker retry without source changes or increased timeouts (five passed in 91.17 seconds; `exe-general-chromium-triage.log`, `test-results/general-triage-report.json`). They are timing-sensitive general-suite failures, not proven Windows-only defects. This does not make the original general run green.

The reordering case actually fails before using an arrow because the selected page ID is empty after import. The final report summary and full errors are retained in ignored `coverage/general-report-summary.json`, generated by `coverage/general-report-summary.cjs`.

### Firefox findings awaiting final classification

- The initial four-worker attempt was aborted after repeated `browserContext.newPage: Target page, context or browser has been closed` errors and 45-second timeouts while setting up `page`, before the affected file-upload tests executed. Its log is `exe-general-firefox-4workers-aborted.log`; screenshots are in `test-results/general-firefox-4workers-aborted/`.
- A complete restart with two workers initially passed the icon, import and printing cases, then reproduced the same startup failures before the file-upload assertions. This second incomplete attempt is retained as `exe-general-firefox-2workers-aborted.log` and `test-results/general-firefox-2workers-aborted/`. Only the owned test queue process trees were stopped. No application source, test cases or timeout limits were changed. Per the user's request to disregard platform failures, no application fix was attempted for browser startup; static proceeds independently. Do not count either partial run as a complete Firefox result or describe the underlying driver/environment cause as proven Windows-exclusive.
- The nested-hosting/offline printing case failed at `export-print-button.spec.ts:409`: `locator.evaluate: Execution context was destroyed, most likely because of a navigation`. Its `expect.poll(linkSuffix)` could evaluate computed style while an option change regenerated the iframe. This same test passed in the earlier focused Firefox run and the two-worker partial general run. The corrective patch uses `expect(...).toPass()` to retry evaluation across navigation, retaining the same content assertions and seven-second assertion deadline. No wrong printed content or failed resource assertion was reported at the original failure point.

### Static-server environment workaround

- The configured `bun x serve dist/static` helper (Node.js 24.12.0) terminated with an unhandled `EMFILE: too many open files` while opening `app/yjs/YjsPropertiesBinding.js`. Subsequent `ERR_CONNECTION_REFUSED` and loading-screen failures are fallout from the dead test server, not independently established app regressions.
- That incomplete attempt is archived as `%TEMP%/exe-general-static-node-aborted.log` and `test-results/general-static-node-aborted/`.
- The full suite was restarted using ignored `coverage/general-static-playwright.config.ts`, which inherits the repository's configuration and changes only its test-directory resolution and static server. Ignored `coverage/general-static-server.ts` serves the same `dist/static` through `Bun.serve`/`Bun.file`, validates requested paths under that directory, and is started/stopped by Playwright. The test cases, assertions, four-worker setting, sandbox and timeout limits are unchanged. A first temporary-server launch used the config directory as its cwd; that command-only error was corrected before starting tests (`exe-general-static-server-start.log`). No production server code was changed.

### Corrective verification after the general suites

- [x] Reproduced the MathJax guard defect before changing the runtime: five negative cases failed while four raw-math controls passed (`exe-general-math-guard-red.log`).
- [x] Corrected `common.js`; all 674 colocated Vitest tests pass, including the nine new cases (`exe-general-math-guard-green.log`). The six executable added runtime lines are all covered (100%; `test-results/general-correction-patch-coverage.json`). Whole-file line coverage is 75.95%; the earlier full frontend suite coverage remains 88.76%.
- [x] Corrected the double-opening preview helper and the navigation-sensitive style assertions without removing assertions or increasing timeouts.
- [x] `make fix` passes with no automatic changes and the same 44 existing warnings (`exe-general-correction-fix.log`).
- [x] Resource bundles rebuilt successfully (`exe-general-correction-resources.log`).
- [x] Current static distribution rebuilt successfully (`exe-general-correction-static-build.log`).
- [x] Focused Chromium verification: six passed in 109.06 seconds, covering CLI 3DMol export, both flipcard cases, both Markdown cases and nested/offline printing options (`exe-general-correction-chromium.log`, `test-results/general-correction-chromium-report.json`).
- [x] Focused static verification: six passed, covering the same CLI export, preview and offline options cases (`exe-general-correction-static.log`, `test-results/general-correction-static-report.json`). The rebuilt distribution uses the documented Bun server workaround.
- [x] Focused Firefox verification: six passed with one worker and unchanged assertions/timeouts (`exe-general-correction-firefox.log`, `test-results/general-correction-firefox-report.json`). This focused success does not replace the incomplete full Firefox suite.
- [x] Removed only trailing whitespace and extra EOF blank lines previously reported by `git diff --check` in the print shell, print frame and print-preview stylesheet. `git diff --check main` passes.
- [x] Final tracked/staged diff and retained-result review. All eight changed tracked files belong to the corrections, their tests, the review log or whitespace cleanup; no files are staged. No commit or push is included in this verification task.

All branch-attributable regressions confirmed by this general run have been corrected and pass focused verification: 674 Vitest tests and 18 browser cases across Chromium, Firefox and static. The other five Chromium failures passed isolated retries without code changes. The general frontend suite passed all 18,173 tests before these corrections, and architecture records pass.

The complete release gates are **not certified green** by this Windows run: the general Bun suite contains the recorded native-platform failures and below-threshold coverage in unchanged files; the integration matrix's five-second setup timeout still reproduces; and the complete Firefox suite was not finished because of repeated page-creation failures. In accordance with the user's direction, Windows-specific failures were documented without unrelated platform fixes or weakened checks. A successful supported CI/Linux release-gate run remains necessary before treating this as a complete production sign-off.

## MathJax follow-up corrections and unstaged review (2026-10-26)

Scope: correct the three findings from the review of `3bfe9236f`, then review the unstaged patch. Only affected tests were run; the general-suite results above were not rerun or superseded.

- [x] **DOM-cloning regression:** replace the cloned-HTML scan with a read-only DOM traversal. Real-browser tests verify that repeated detection neither reloads images nor constructs additional custom elements.
- [x] **Incomplete raw-math detection:** share the detector between page initialization and activity updates. Ignore rendered formulas, code examples, scripts, styles, comments, attributes and configured ignored classes. Preserve raw TeX/MathML detection, process-class overrides and delimiters split across adjacent text nodes.
- [x] **Pre-existing duplicate rendering:** retain each exported SVG and its original accessible MathML. Wrap the latter in MathJax's recognized `mjx-assistive-mml` container before initial page typesetting and subsequent updates. The startup protection included in the unstaged patch was reviewed and tested as well. Browser tests use actual `LatexPreRenderer` output and the vendored engine, checking node identity, one visible SVG, retained MathML and repeated-call idempotence.
- [x] **Initialization side effect caught during this review:** routing initialization through activity refresh initially cleared previously registered MathJax items. A real-browser regression failed with one registered item instead of two. Initialization now passes `clear: false`; activity refresh retains its existing clearing behavior. The regression passes in Chromium and Firefox.
- [x] **Focused unit checks:** 733 passed across `common.test.js` and `common_mathjax.test.js`. Log: `%TEMP%/exe-math-fix-unit.log`. Patch line coverage is 53/53 executable added/modified lines (100%); whole-file line coverage is 80.37%. LCOV: `coverage/mathjax-fix/lcov.info`.
- [x] **Focused browser checks:** 18 passed in Chromium/Firefox, including the new shared-runtime regressions and the existing pre-rendered/runtime-MathJax preview flows. Log: `%TEMP%/exe-math-final-e2e.log`. After refining the loaded-engine fixtures to insert content strictly after startup, all four affected cases passed again (`%TEMP%/exe-math-dynamic-e2e.log`). No missing runtime resource or external dependency was accepted by the isolated runtime checks.
- [x] **Build and lint:** resource bundles rebuilt successfully (`%TEMP%/exe-math-fix-build.log`). `make fix` passed, formatting only the new browser spec; the same 44 existing warnings remain (`%TEMP%/exe-math-fix-lint.log`). `git diff --check` passes.
- [x] **Scope and repository state:** no theme matrix, general tests, commit or push. Changes remain unstaged. These focused checks do not certify the full release gates or constitute a new static-distribution/Electron validation.
