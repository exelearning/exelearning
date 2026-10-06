---
tracking_issue: 2511
title: "iDevice runtime contract — tasks"
date: 2026-10-06
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# iDevice runtime contract — tasks

The plan is incremental. Each step is one reviewable PR with its own tests, and
leaves every iDevice working. Steps 1–3 change no iDevice. Steps 4 onwards move one
iDevice, or one group of iDevices sharing a helper, at a time.

## Plan

### 0. Agree on the contract

- [ ] Review this change directory and ADR-2511-01, ADR-2511-02 and ADR-2511-03.
      Then move the change to `accepted` and the ADRs to `Accepted`.
- [ ] Merge PR #2512 (#2510). Add `ADR-2510-01` to `related_adrs` here and to
      `related.adrs` in ADR-2511-02. `architecture-check` rejects references to ADRs
      that are not on `main`.

### 1. Runtime core (no iDevice changes)

- [ ] Add `public/app/common/exe_idevice_runtime.js` with
      `$exe.ideviceRuntime.run / enhance / rendered / lifecycle / destroy` and
      `ResourceLifecycle`, plus `exe_idevice_runtime.test.js` (design §1, §5).
- [ ] Ship it wherever `exe_export.js` ships (`src/shared/export/constants.ts`,
      `PageRenderer.ts`, `PrintPreviewExporter.ts`, `FileSystemResourceProvider.ts`)
      and load it in `views/workarea/workarea.njk`. Cover it with exporter tests and
      `make test-e2e-static`.
- [ ] `exe_export.js`:
  - [ ] `initJsonIdevice()` renders through `run()`;
  - [ ] `afterIdeviceRendered()` becomes a wrapper around `enhance()`;
  - [ ] the page dispatches `exe-idevices-rendered`;
  - [ ] print, search highlighting and `post-js` wait for it (design §3).
- [ ] Playwright: an exported page with a Case study and a Form (spec scenario 1).

### 2. One enhancement list

- [ ] Move the export-side enhancements (`$exeFX`, lightbox, dialog sizes) into
      `enhance()`. Each one gets an "apply twice equals once" test.
- [ ] Make the rest context-aware and idempotent, and move them into `enhance()` one
      at a time:
  - [ ] `dl.init` (positional ids);
  - [ ] the `exe-enlarge` icons;
  - [ ] `setIframesProperties`;
  - [ ] tooltips;
  - [ ] the media player;
  - [ ] the highlighter;
  - [ ] ABC music;
  - [ ] Mermaid;
  - [ ] math;
  - [ ] the hangman `<style>` guard.
- [ ] `$exe.init()` calls `enhance(document)`.
- [ ] Replace the two editor copies of `loadLegacyExeFunctionalitiesExport()` with
      one call to `enhance(document)` on page load, plus `enhance(node)` after a save.

### 3. Editor host

- [ ] `IdeviceNode.exportProcessIdeviceJson()` renders through `run()` with an
      `exportHtmlView()` mount.
- [ ] Call `destroy()` wherever `destroyEditionInstance()` is called today, and before
      `generateContentExportView()` replaces a body.
- [ ] `EditionLifecycle` delegates its resource registry to `ResourceLifecycle`. Its
      existing tests are kept unchanged.
- [ ] Playwright: edit and save an iDevice with a clock twice, and assert that one
      clock is running (spec scenario 6).

### 4. JSON iDevices that render at runtime (`jsonOnlyIdevices`)

One PR per iDevice. Each one passes the contract test helper (two instances, destroy,
no leaks):

- [ ] casestudy: scope `addEvents` to the node and pass the node to `updateLatex`.
- [ ] form: scope math; own the clock and the fallback poll; `init` returns a promise
      when the questions are ready; call `rendered(node, 'update')` on slideshow
      changes.
- [ ] image-gallery: move the markup into `renderView`; scope the click handlers;
      own the SimpleLightbox instance and cap the poll.
- [ ] magnifier: initialize MojoMagnify for the node only; `init` returns the
      script-load promise.
- [ ] trueorfalse: remove the dead `questionsReady` listener; own the `document`
      handler and the SCORM registration.
- [ ] adaptative-quiz: scope math; own the clock; call `rendered(node, 'update')` per
      question.
- [ ] file-attachment: `init` returns the `asset://` resolution promise.
- [ ] three-sixty-viewer: register its existing disposal as `destroyRuntime`.

### 5. Other JSON iDevices

- [ ] text and markdown-text: scope math to the node.
- [ ] scrambled-list: enable only the node's list; own the SCORM registration.
- [ ] three-d-viewer: no fallback to the whole document; own the observers; `init`
      returns the boot promise; register `destroy(wrapper)` as `destroyRuntime`.
- [ ] slide, lomloe: keep their page-scoped wiring (R2.4) and document it.

### 6. Gamification helpers

- [ ] `reportActivity()` owns `registry.unregister(id)`. `observeResize()` and the game
      clock are owned by the instance lifecycle when one exists.

### 7. HTML-type games (separate issue)

- [ ] Open a follow-up issue to give `initGame()` a per-node entry point and stop the
      self-boot, game by game. When every game on a page is per-node, the editor
      can drop its page reload on remote edits (#2434).

### 8. Guidance

- [ ] When step 1 lands, add a "Runtime lifecycle" section to
      `.agents/skills/idevice/SKILL.md` (and its `.claude/skills/` copy) next to the
      edition lifecycle.
- [ ] Decide separately whether `jsonOnlyIdevices` moves into each iDevice's
      `config.xml`.

## Progress

- 2026-10-06: contract, design, research and ADRs drafted for review.

## References

- Issues #2170, #2197, #2271, #2293, #2428, #2434, #2510, #2511
- PRs #2171, #2301, #2512
- ADR-2293-01, ADR-2492-01, ADR-2511-01, ADR-2511-02, ADR-2511-03
