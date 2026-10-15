---
id: ADR-2469-01
title: "Load optional iDevice libraries on demand from a single npm-managed copy"
status: Proposed
date: 2026-09-27
tracking_issue: 2469
deciders:
  - "@erseco"
reviewers: []
related:
  prs: [2469, 2465, 1593]
  changes: ["1593-vendored-frontend-libs-build-pipeline"]
  adrs: [ADR-1593-01, ADR-1593-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5.5"
---

# ADR-2469-01: Load optional iDevice libraries on demand from a single npm-managed copy

## Context

Three iDevices can save a report as PDF: checklist (`listacotejo-IDevice`),
progress report (`informe-IDevice`) and rubric (`exe-rubrics-DataGame`, legacy
`rubric-IDevice`). Each carried its own `ensureJsPDF` helper that injected
`https://cdn.jsdelivr.net/npm/jspdf/dist/jspdf.umd.min.js` when the user clicked
the button (for example `public/files/perm/idevices/base/rubric/export/rubric.js`
before commit `5ab01ef8a`).

That had two problems:

- **Remote executable code.** The WordPress.org review of the wp-exelearning
  plugin, which ships the static editor and its exported packages, flagged the
  load under Plugin Directory Guideline 8 (no executable code from third-party
  servers). The same load also breaks offline use, the desktop app and
  `file://` exports.
- **Unpinned version.** The URL has no version, so the code that ran could
  change at any time without a change in this repository.

PR #2465 fixed the remote load by committing three hand-copied
`jspdf.umd.min.js` files, one next to each iDevice. That reintroduces the
problem ADR-1593-01 removed: opaque, duplicated minified blobs with no declared
version and no update path.

jsPDF is large (`dist/jspdf.umd.min.js` of jspdf 4.2.1 is 420,165 bytes) and is
needed only when a user explicitly asks for a PDF, in pages that contain one of
those three iDevices.

## Problem

How should a third-party library that only some iDevices need, and only on a
user action, be sourced, packaged into exports, and loaded at runtime, without
depending on a CDN and without making every page pay for it?

## Decision drivers

- No executable code from third-party servers (WordPress.org Guideline 8,
  offline, desktop, `file://`).
- A pinned, auditable version with an automated update path (ADR-1593-01,
  ADR-1593-03).
- A single source of truth: one copy, not one per iDevice.
- Export size and page weight: don't ship or download 420 KB where it is not used.
- One loader that works in every context that runs iDevice export code: the
  editor, the static build, the preview and exported packages (HTML5, single
  page, SCORM 1.2/2004, IMS, EPUB3).

## Options considered

### Option 1: Keep the CDN, but pin the version (and add SRI)

Fixes the unpinned version only. It is still remote executable code, so it
still fails Guideline 8 and still fails offline and in `file://` exports.
Rejected.

### Option 2: One committed copy per iDevice (PR #2465)

Works offline, but it is three copies of the same 420 KB blob with no declared
version, updated by hand. It contradicts ADR-1593-01's single-source rule, and
every export with any of the iDevices ships its own copy. Rejected; this PR
replaces the jsPDF part of #2465.

### Option 3: One npm-managed copy under `public/libs/`, always referenced by a `<script>` tag

Solves sourcing, but every page of every export that contains one of the
iDevices would download and parse 420 KB on load, even though almost no visitor
saves a PDF. Rejected.

### Option 4: One npm-managed copy, loaded with dynamic `import()`

jsPDF's UMD build is not an ES module, and module scripts are subject to CORS,
so `import()` fails for pages opened from `file://`, a supported way to open
HTML5 exports. The export pages are classic scripts built around jQuery and the
`$exe` global. Rejected.

### Option 5: One npm-managed copy, packaged only when needed, loaded on demand by a classic `<script>` (chosen)

Source jsPDF from npm through #1593's `bundle:vendor` step, package it only
when a matching iDevice is present, and inject a classic `<script>` from the
package's own `libs/` folder when the user clicks the button.

## Evidence

All paths below are on branch `chore/bundle-jspdf-from-npm` at commit `5ab01ef8a`.

- `package.json`: `jspdf` `^4.2.1` in devDependencies, locked by `bun.lock`.
- `scripts/copy-vendor-libs.js`: copies `jspdf/dist/jspdf.umd.min.js` to
  `public/libs/jspdf/jspdf.umd.min.js` with `stripSourceMap: true`; the output
  is gitignored like the other generated libs. Before stripping, its SHA-256
  matches the bytes #2465 vendored.
- `src/shared/export/constants.ts`: a `jspdf` entry in `LIBRARY_PATTERNS`
  detects the iDevices by their content classes and sets `loadOnDemand: true`.
- `src/shared/export/interfaces.ts`: the new optional
  `LibraryPattern.loadOnDemand` flag.
- `src/shared/export/renderers/PageRenderer.ts`: detected libraries with
  `loadOnDemand` are packaged but get no `<script>`/`<link>` tag, in both
  multi-page and single-page output.
- `public/app/common/common.js`: `$exe.getLibUrl(file)` resolves `libs/` from
  the `libs/jquery/jquery.min.js` script tag, which the editor
  (`/{version}/libs/…`), the static build (`./libs/…`), the preview and exported
  pages (`libs/…`, `../libs/…`) all load. `$exe.loadJsPDF(onReady, onError)`
  uses it, reuses an in-flight tag, and on failure logs an error, removes the
  tag so a later click can retry, and calls `onError`. It has no remote fallback.
- `public/files/perm/idevices/base/{checklist,progress-report,rubric}/export/*.js`:
  the three `ensureJsPDF` copies and their CDN URL are gone; the iDevices call
  `$exe.loadJsPDF` and keep their existing PNG fallback in `onError`.
- `public/app/yjs/ResourceFetcher.js`: `jspdf` is registered as a third-party
  lib, so the existing `fetchLibraryFile` path serves it from the server, static
  and file-system providers.

## Decision

We will handle third-party libraries that only some iDevices need, on demand,
as follows:

1. **Source them from npm** through #1593's `bundle:vendor` pipeline
   (ADR-1593-01), as one shared copy under `public/libs/<name>/`. No committed
   copies, no per-iDevice copies.
2. **Package them only when needed**, with a `LIBRARY_PATTERNS` entry that
   detects the iDevices that use them by their content classes. SCORM and IMS
   list the file in `imsmanifest.xml` like any other packaged library.
3. **Load them on demand**, not with a `<script>` tag in the exported page. The
   pattern sets `loadOnDemand: true`, so `PageRenderer` skips the tag, and the
   iDevice calls a shared `$exe` loader that injects a classic script from the
   `libs/` folder next to jQuery. For jsPDF that loader is `$exe.loadJsPDF()`.
4. **Fail closed.** There is no CDN fallback. If the local file is missing or
   fails to load, the loader reports the error and the iDevice uses its
   degraded path (PNG for the PDF reports).

## Consequences

### Positive

- No remote executable code for PDF export; it works offline, in the desktop
  app and in `file://` exports, and satisfies Guideline 8.
- One pinned, lock-filed copy updated by Dependabot with the other frontend
  libraries (ADR-1593-03).
- The 420 KB file is packaged only in exports that contain a PDF-capable
  iDevice, and downloaded only when a user asks for a PDF.
- `loadOnDemand` and `$exe.getLibUrl()` are reusable: the next optional library
  needs a `LIBRARY_PATTERNS` entry, a `COPIES` entry and a small loader, not new
  export plumbing.

### Negative

- The loader depends on the page loading jQuery from `libs/jquery/jquery.min.js`.
  A context that does not, gets no jsPDF (it fails closed with a console error
  rather than guessing a path).
- Detection is by content class. A new iDevice that needs jsPDF must be added
  to the `jspdf` pattern, or its exports will not contain the file.
- Where the local file is missing, users get a PNG instead of a PDF, where the
  CDN would previously have masked the gap.

### Neutral

- Because the file is not `<script>`-tagged, tooling that discovers a page's
  dependencies from its markup will not see it; the package manifest still does.
- rubric's `ensureHtml2Canvas` jsDelivr fallback is out of scope and unchanged.

## Risks

- **Missed detection** (low likelihood, moderate impact): a renamed iDevice
  class drops jsPDF from exports. Mitigated by the `LibraryDetector` and
  exporter tests below, which fail if the classes stop matching.
- **jQuery path change** (low likelihood, moderate impact): moving jQuery out of
  `libs/jquery/` breaks `getLibUrl`. Mitigated by the `getLibUrl` unit tests and
  the rubric end-to-end PDF test.

## Validation

Tests added in PR #2469:

- `public/app/common/common.test.js`: `getLibUrl` for export, subpage, static
  and versioned-editor paths; `loadJsPDF` ready, in-flight reuse, load error,
  missing global and missing `libs/` cases, and that it never uses a CDN.
- `public/files/perm/idevices/base/{checklist,progress-report,rubric}/export/*.test.js`:
  the PNG fallback goes through `$exe.loadJsPDF`, plus a source guard that fails
  on any jsPDF CDN URL.
- `scripts/copy-vendor-libs.spec.ts`: jsPDF is copied once, to `libs/`, without
  its source-map comment.
- `src/shared/export/utils/LibraryDetector.spec.ts`: detection for each iDevice
  class and none for unrelated content.
- `src/shared/export/renderers/PageRenderer.spec.ts`: no script tag for
  on-demand libraries in multi-page and single-page output.
- `src/shared/export/exporters/Html5Exporter.spec.ts` and `Scorm12Exporter.spec.ts`:
  jsPDF is packaged (and listed in `imsmanifest.xml`) only when a PDF-capable
  iDevice is present, with no script tag.
- `test/e2e/playwright/specs/idevices/rubric.spec.ts`: saving a rubric as PDF in
  the preview downloads a `.pdf`, and every jsPDF request goes to
  `/libs/jspdf/jspdf.umd.min.js`, none to a CDN.

## Follow-up work

- Apply the same pattern to other remote or duplicated on-demand libraries,
  starting with rubric's html2canvas CDN fallback (the remaining part of #2465).

## References

- PR #2469: this change.
- PR #2465: the rejected per-iDevice copy approach.
- PR #1593, [ADR-1593-01](ADR-1593-01-vendored-frontend-libs-from-npm.md),
  [ADR-1593-03](ADR-1593-03-dependabot-grouped-frontend-dependency-updates.md).
- WordPress.org Plugin Directory Guideline 8:
  <https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/#8-plugins-may-not-send-executable-code-via-third-party-systems>
- MDN, CORS for module scripts:
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#other_differences_between_modules_and_classic_scripts>
