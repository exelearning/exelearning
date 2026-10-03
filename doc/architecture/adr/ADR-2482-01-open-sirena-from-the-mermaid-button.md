---
id: ADR-2482-01
title: "Open Sirena, vendored from npm, from the Mermaid button"
status: Proposed
date: 2026-09-28
tracking_issue: 2482
deciders:
  - "@jjdeharo"
reviewers: []
related:
  prs: [2482, 2487, 2359]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2482-01: Open Sirena, vendored from npm, from the Mermaid button

## Context

The Mermaid button of the TinyMCE editor (`exemermaid`) opened a dialog with a
plain textarea. The diagram had to be written without seeing it, or written in
another tool and pasted. The result was stored as `<pre class="mermaid">`, with
optional `max-width` / `max-height`, and rendered by `$exe.mermaid` in the
editor, the preview and exports.

Sirena (https://sirenaapp.github.io, AGPL-3.0-or-later, by @jjdeharo) is a Mermaid
editor that shows the code next to the drawing, with examples, syntax help and
visual formatting tools. EdiCuaTeX, by the same author, is already integrated
for formulas: its button opens it in a TinyMCE window, it writes the result back
into the editor, and it is vendored from a pinned npm package by
`scripts/vendor-edicuatex.ts` (#2359).

## Problem

How should eXe offer a visual Mermaid editor without changing the stored format,
depending on the network or keeping a second copy that can drift?

## Decision drivers

- Keep `<pre class="mermaid">` and its max-size styles, so existing projects,
  rendering and exports do not change.
- Work offline and in the static and Electron builds.
- What is seen while editing must be what the iDevice shows.
- Translations through eXe's catalogue, in every eXe language.
- No duplicated vendoring logic.

## Options considered

### Option 1: Keep the textarea dialog

No work, but the button stays useful only to those who already know Mermaid's
syntax.

### Option 2: Link to the public Sirena site

No vendoring, but it needs the network, it cannot write back into the editor
(different origin) and the diagram would round-trip by copy and paste.

### Option 3: Vendor Sirena and open it in a TinyMCE window, like EdiCuaTeX

Same origin, so Sirena can read the block under the cursor and write it back.
Offline in every build. Needs a vendoring script, a plugin change and the
translations.

### Option 4: Insert the diagram as an SVG image

Identical look everywhere, but the diagram stops being editable Mermaid code and
bypasses eXe's rendering and export pipeline.

## Evidence

- EdiCuaTeX integration: `scripts/vendor-edicuatex.ts`,
  `public/libs/tinymce_5/js/tinymce/plugins/edicuatex/plugin.min.js`, #2359.
- Sirena's eXe mode and its decisions: `sirenaapp/sirenaapp.github.io`,
  `docs/adr/0029-…`, published as `sirenaapp` 2.2.0 on npm with provenance.
  Since 2.0.0 the package ships without Mermaid (19 files, 687 kB unpacked,
  instead of 127 files and 6.1 MB) and `sirena.js` imports its own Mermaid only
  when the host has none: inside eXe, opening Sirena requests no Mermaid file of
  its own (checked in Chromium and Firefox; `docs/adr/0030-…`).
- While the TinyMCE URL dialog loads, `editor.selection.getNode()` returns `P`
  instead of the `PRE` under the cursor (measured in Chromium 149 and
  Firefox 151): the button has to record the context when it is pressed.
- With Sirena drawing with eXe's `window.mermaid`, seven diagram types
  (flowchart, with `<br>`, with formulas, sequence, class, state, pie) have the
  same viewBox and the same node boxes in Sirena and in the iDevice, in
  Chromium and Firefox. With Sirena's own Mermaid 12 only the class diagram
  matched (node sizes and layout engine differ between Mermaid 11 and 12).
- With eXe's Mermaid 11, four of Sirena's 27 examples are diagram types that
  only exist in Mermaid 12 (swimlane, Ishikawa, tree view, Venn), and the
  treemap does not accept `accTitle`/`accDescr`. Since 1.0.8, Sirena leaves the four
  out and loads the treemap with those lines as comments: 23 examples and 20 diagram
  types are offered, and all 23 render without error in Chromium and Firefox.
  All 135 example codes (27 × 5 languages) render with Mermaid 12.
- The catalogue keeps keys as written in the source (`Don\'t show again`,
  literal `\n`), so `_()` with the real string misses them; checked through
  `/api/translations/fr`.

## Decision

We will use option 3:

- `sirenaapp` is a pinned dependency; `scripts/vendor-sirena.ts` writes
  `public/app/common/sirena/` in `build:all`, gitignored, checked by the
  Dockerfile and registered in `GENERATED_SOURCE_DIRS`. The shared vendoring
  logic moves to `scripts/vendor-package.ts`.
- The `exemermaid` button opens Sirena (`sirena_url`, relative in static and
  offline modes) and records the Mermaid block, the selected text and a bookmark,
  offered as `editor.plugins.exemermaid.getContext()`.
- Sirena brings no Mermaid of its own: it draws with eXe's, so editing, preview
  and export use a single Mermaid version, managed by eXe.
- Inside eXe, Sirena draws with eXe's Mermaid and configuration, without its own
  retouches, writes back `<pre class="mermaid">` with the same max-size rules
  (`eXeLearning.mermaidMaxSize`), and adds no header of its own: the layout
  engine is left to eXe's Mermaid configuration, as for every other diagram.
  Sirena only writes it if the user picks another engine, and keeps it if the
  code already had it (sirenaapp 2.2.0). Up to 2.1.3 it wrote eXe's default
  engine into every diagram so that it kept its look on Mermaid 12; the review
  proposed instead to set `layout: 'dagre'` and `look: 'classic'` in eXe's own
  configuration (#2449), which also covers diagrams never opened in Sirena.
- Inside eXe, Sirena only offers the examples and diagram types that eXe's
  Mermaid can parse (`mermaid.parse` with `suppressErrors`), retrying with
  the accessibility lines (`accTitle`, `accDescr`) as comments, as Sirena
  already writes them for the types that do not support them, before leaving
  one out.
- Its strings go into every locale through the usual extraction, in a separate
  translations PR (#2487), as the guidelines ask for code PRs.

## Consequences

### Positive

- A visual editor for diagrams, with no change to the stored format.
- The preview matches the iDevice whatever Mermaid version eXe ships.
- Updating Sirena is a version bump, as with EdiCuaTeX.

### Negative

- If eXe's Mermaid fails to load, Sirena has no Mermaid to fall back on and
  shows an error instead of the diagram (eXe could not render it either).
- 295 new strings per locale (#2487); DE, EO, FR, IT, PT, RO and VA are `~` placeholders
  pending review.

### Neutral

- The textarea dialog is removed; its strings become obsolete.

## Risks

- A Sirena release could break the integration; the pinned version and the E2E
  tests of the Mermaid button guard against it.
- If eXe's Mermaid cannot load, Sirena has none of its own and shows an error
  instead of the diagram.

## Validation

- `make test-unit` and `bun run test:frontend` green; the four Mermaid E2E tests
  pass in chromium, firefox and static.
- The E2E test checks that Sirena inserts the code without a header of its own.

## Follow-up work

- Review the `~` translations of Sirena's strings.
- When #2449 (Mermaid 12) is merged, the ELK engines appear in Sirena on their
  own. To keep the look of existing diagrams, #2449 should set `layout: 'dagre'`
  and `look: 'classic'` in eXe's Mermaid configuration; Sirena follows it.
- #2475: `$$…$$` formulas in iDevice content are reduced to `$` on save.

## References

- #2482 (this change), #2359 (EdiCuaTeX vendoring), #2449, #2475.
- https://github.com/sirenaapp/sirenaapp.github.io/blob/main/docs/adr/0029-dentro-de-exelearning-sirena-devuelve-el-diagrama-al-editor-como-edicuatex.md
