---
tracking_issue: 2769
title: "iDevice refactoring test — research"
date: 2026-11-17
authors:
  - "@ignaciogros"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# iDevice refactoring test — research

Findings gathered on `main` at `d1e76c5c4` (2026-11-17) while making the starting choices in [design.md](design.md).

## R1. TypeScript is not type-checked today

- Bun runs and bundles TypeScript by stripping types without checking them (backend, `src/shared/`, the Slide
  editor). Biome does not check types either.
- No `tsc` or type-check step exists in `package.json`, the `Makefile` or `.github/workflows/`.
- `tsconfig.json` is permissive (`strictNullChecks: false`, `noImplicitAny: false`), inherited from the
  NestJS era. `typescript` ^7.0.2 is installed.
- Consequence: the main TypeScript benefit (contract violations caught while developing) does not exist
  without a type-check gate. [ateeducacion/exelearning#42](https://github.com/ateeducacion/exelearning/pull/42)
  adds it (see D7).

## R2. Existing TypeScript iDevice: Slide

- Only `slide` uses TypeScript, and only for its editor: `public/files/perm/idevices/base/slide/src/*.ts`
  (19 modules), built by `scripts/build-slide-editor.ts` (`bun run bundle:slide-editor`) into
  `edition/slide-editor.bundle.js` (IIFE, global `__slideEditorInit`). Fabric and DOMPurify are loaded
  separately as window globals.
- `edition/slide.js` bridges to the classic lifecycle: inside `init()` it calls
  `window.__slideEditorInit.mount(container, opts)` and uses `this.$lifecycle`.
- The DOM is built mostly with `createElement`.
- The export side is still classic JavaScript (`export/slide.js`).
- `public/files/perm/idevices/**` is excluded from Biome, so Slide's TypeScript is neither linted nor
  formatted. Its tests run in Vitest.
- Precedent outside iDevices: shared import/export code is TypeScript in `src/shared/` bundled for the browser
  (`scripts/build-exporters-bundle.js`, `scripts/build-importers-bundle.js`).

## R3. Export contract of a JSON iDevice

- The export object exposes `renderView(data, accessibility, template)`, which returns an **HTML string**,
  then `renderBehaviour(data, accessibility)` and `init(data, accessibility)`.
- In the workarea, `ideviceNode.js` (~line 1969) stores the result as `htmlView` and inserts it.
- In exported pages, `public/app/common/exe_export.js` (`renderWithTemplate`, ~line 558) inserts the string
  and then calls `renderBehaviour` and `init`.
- Consequence: export-side components must be able to produce escaped HTML strings; editor components can
  build DOM directly. To be confirmed in the contract phase.

## R4. Implicit registration of JSON iDevices

A new JSON iDevice has to be added by hand to lists outside its folder:

- `src/shared/export/browser/idevice-config-browser.ts:53` (`jsonIdevices`).
- `public/app/common/exe_export.js:494` (`jsonOnlyIdevices`: iDevices whose content lives only in
  `jsonProperties` and need `renderView` in the export).

`config.xml` already declares `<component-type>json</component-type>`, so these lists duplicate it. This is an
example of the implicit contract the test aims to remove.

## R5. `default-visibility` is documented but not implemented

- `doc/elpx-format/idevices/config-xml.md` says `<default-visibility>0</default-visibility>` hides an iDevice
  except in a "developer/advanced mode". No code reads that element, and no such mode was found.
- `example` is hidden because its id is hard-coded in
  `public/app/workarea/menus/idevices/menuIdevicesCompose.js:181` and
  `public/app/workarea/modals/modals/pages/modalIdeviceManager.js:428`.
- Not needed for this test (D8); worth a separate fix of either the code or the documentation.

## R6. The `form` iDevice

- Container of questions of four types: `dropdown`, `selection` (`selectionType: 'single' | 'multiple'`),
  `true-false`, `fill`.
- Per question (`getCuestionDefault`, `form/edition/form.js:82`): `baseText`, `answers` as
  `[isCorrect, text]` pairs, `feedbackRight`, `feedbackWrong`, `suggestion`, `customScore`, `time`, and others.
- 3,351 lines in the editor and 2,004 in the export, with inline HTML templates.

## R7. Import of 2.9 `MultichoiceIdevice` loses data

`src/shared/import/legacy-handlers/MultichoiceHandler.ts` converts 2.9 `MultichoiceIdevice` and
`MultiSelectIdevice` into `form` `selection` questions:

- Per-option feedback is stored as a third tuple element: `answers: [isCorrect, text, feedback]`.
- The question hint is stored as `hint`.
- Option HTML is stripped (`stripHtmlTags`), so formatting, images and formulas are lost.

But `form` never reads `answers[n][2]` nor `hint` (it uses `suggestion`), so learners never see them, and
re-saving an edited question rebuilds `answers` as `[checked, text]` (`form/edition/form.js:1905`), dropping
the per-option feedback for good.

Out of scope for this branch; to be reported as a separate issue. A data type shared by the importer and the
iDevice would have caught it at compile time.

## R8. Tabs in #2700 (input, not target)

Branch `idevices-refactor`, `public/app/common/common_idevices_edition.js:3384`: an ordered catalogue of
shared tabs (`instructions`, `options`, `contents`, `grading`, `passwords`, `texts`, `after`, `feedback`),
each shown only when an iDevice declares it, with per-iDevice title/info overrides and own tabs (`extra`).
`grading` merges the former SCORM tab, pass score and progress report.

Guidance from the user for this test: `after` will not be shared; `texts` will become "Custom texts" and only
apply to iDevices that have them; not every iDevice will use every shared tab. The section model (D4) was
taken as the starting point after evaluating a fixed catalogue, free sections, and the mixed option.

## R9. Test runners and gates by location

- `bunfig.toml` ignores `public/**`; frontend tests run in Vitest (`vitest.config.mts`, 80% threshold).
- `src/**/*.ts` runs in Bun with a colocated `*.spec.ts` and a 90% threshold; Bun tests needing DOM import
  the happy-dom setup explicitly.
- `make fix`: Biome check and format on `src/` and `test/`, lint only on `public/app/`, nothing on
  `public/files/perm/idevices/**`.
