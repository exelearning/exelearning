---
id: ADR-2558-01
title: "Retire the mindmaps editor and convert legacy maps to Mermaid on request"
status: Proposed
date: 2026-10-18
tracking_issue: 2558
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: [2558, 2556, 2557, 2447]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2558-01: Retire the mindmaps editor and convert legacy maps to Mermaid on request

This ADR records **one of three competing alternatives** for maintainers to evaluate. It is
not an approved decision: A (#2447), B (#2557) and C (#2558) are mutually exclusive, and
only one should be accepted.

## Context

The Text iDevice's TinyMCE `exemindmap` plugin opened mindmaps.app (by David Richard, AGPL V3)
in an iframe. A saved map is a PNG plus the editor's JSON document:

```html
<div class="exe-mind-map">
  <figure class="exe-figure exe-image position-center" style="width: Wpx;">
    [<a href="…" rel="lightbox">]<img src="…" width="W" height="H" alt="Title" />[</a>]
    [<figcaption class="figcaption"><span class="title"><em>Title</em></span></figcaption>]
  </figure>
  <p class="exe-mindmap-code">{ "id", "title", "mindmap": { "root": … }, "dates", "dimensions", "autosave" }</p>
</div>
```

(`public/libs/tinymce_5/js/tinymce/plugins/exemindmap/plugin.min.js` @ `a4b97167d`, `onSubmit`).

The editor carries private copies of jQuery 1.6.1, jQuery UI 1.8, Cropper, jQuery Cropper,
FileSaver and miniColors: 37 shipped files, 574,669 bytes (`public/app/common/mindmaps/` and
`exemindmap/editor/` @ `a4b97167d`). The WordPress.org review of `wp-exelearning` flagged such
outdated and duplicated libraries. Ignacio Gros, author of the original integration, suggested
read-only legacy maps if maintenance became a problem, since eXeLearning already renders Mermaid.
After #2556 it renders Mermaid with Pele in the editor, browser exports and server/CLI exports.
The team also declined to embed the Sirena Mermaid editor because eXeLearning should be a
content container rather than an editor for every content type
([#2482 comment](https://github.com/exelearning/exelearning/pull/2482#issuecomment-6186453552)).

The old plugin also stored the JSON damaged (`exemindmap/editor/js/custom.js` @ `a4b97167d`,
`save()`): it wrote `JSON.stringify(json).replace(/\\"/g, '"').slice(1, -1)`, and inserted it
into the paragraph unescaped, so TinyMCE parsed a caption such as `<clima>` as an element and
appended `</clima>` after the JSON.

## Problem

How should eXeLearning handle mind maps without maintaining the mindmaps.app editor, while
existing content keeps working?

## Decision drivers

- Preserve existing educational content by default: no silent change on open, save or export.
- Reduce the dependencies and code eXeLearning maintains.
- Reuse the Mermaid/Pele pipeline from #2556 instead of adding another editor or renderer.
- Give authors a migration path that loses no nodes or text.
- Accessibility and i18n of whatever UI remains.

## Options considered

### Option A: keep mindmaps through a maintained fork (#2447)

Pros: keeps the graphical editor and its look; minimal change for users.
Cons: keeps an old application architecture, a fork to maintain and its integration code;
32 shipped files, 472,378 bytes, two vendoring scripts.

### Option B: replace it with Mind Elixir (#2557)

Pros: modern graphical editor; converts legacy structure; removes mindmaps.app.
Cons: another third-party editing application (three new npm dependencies), its own bundle
(7 shipped files, 164,325 bytes), serialization and rendering responsibilities, and maps look
and behave differently.

### Option C: remove the editor, convert to Mermaid only when asked (#2558)

Pros: no dedicated editor; 2 shipped files (6,969 bytes) plus a 2,359-byte converter in the
existing importers bundle; no new dependencies; reuses Mermaid/Pele; legacy maps
stay byte-identical until the author converts them.
Cons: no graphical mind map authoring; converted maps look different; Mermaid text is less
approachable for non-technical authors; colours, fonts, positions and folding are not
representable.

## Evidence

- Sizes: measured on each branch, counting files under `public/app/common/mindmaps/` and
  `exemindmap/` without tests or TS sources, plus generated bundles (#2557's
  `bundle:mindmap-editor` output was built). Details in #2558.
- Conversion fidelity: `src/shared/import/legacyMindmap.spec.ts` @ #2558 converts the three
  maps of `test/fixtures/legacy-mindmaps.elpx` (3, 16 and 311 nodes, produced by the old plugin),
  rebuilds the tree from the Mermaid output and renders it with `pele@1.6.0`, checking nodes,
  edges, branches and labels.
- Exports: `src/cli/commands/elp-export.spec.ts` @ #2558 exports legacy and converted maps
  together to HTML5, single page, SCORM 1.2/2004, IMS, EPUB3 and ELPX.
- Editor flow: `test/e2e/playwright/specs/idevices/mindmap-legacy-conversion.spec.ts` @ #2558
  (server and static builds).

## Decision

Proposed: option C.

- Delete mindmaps.app, the editor iframe and its route. Remove the toolbar button.
- Keep `exemindmap` as a migration-only plugin. A contextual "Convert to Mermaid" button on a
  selected legacy map opens a confirmation with the losses and a Pele preview. On confirmation,
  one undo step replaces the image with `<pre class="mermaid">` inside the original figure
  (caption kept), wrapped in `div.exe-mindmap-converted` with the original
  `p.exe-mindmap-code` moved unchanged next to it as archived data.
- After conversion, Mermaid source is the only editable representation. The archived JSON is
  never read again.
- `src/shared/import/legacyMindmap.ts` reads the JSON, undoing only the two known save defects,
  rejects anything else, and writes Mermaid with label escaping (Mermaid directives, entities
  and markdown delimiters) taken from `mindElixirToMermaid()` in
  `@erseco/mind-elixir-export-mermaid` (MIT, same author), inlined instead of added as a
  dependency because only that small part is used.

## Consequences

### Positive

- −35 shipped files and −565,341 bytes raw (−167,456 gzip) on top of #2556; no private jQuery,
  jQuery UI, Cropper or FileSaver.
- Unconverted maps display with no script in every format, online and offline.
- New and converted diagrams share one pipeline (Mermaid source → Pele SVG).

### Negative

- Authors lose graphical mind map editing. Converting changes appearance and drops colours,
  fonts, positions and folding.
- The PNG is no longer referenced after conversion; undo is the only way back during the session.

### Neutral

- No new dependencies. The inlined escaping produces output identical to the library's (B uses
  the library itself), so a fix there should be mirrored here.
- Old translation strings drop out at the next catalogue extraction.

## Risks

- Usage is unknown: if many authors rely on graphical mind maps, C removes a valued feature.
  Medium likelihood, high impact; it is the main reason this is a product decision.
- A legacy caption that TinyMCE had already altered (for example, a stripped tag) cannot be
  restored. The reader refuses JSON it cannot parse rather than guessing.

## Validation

- The tests listed under Evidence, in CI.
- Before accepting, maintainers compare A, B and C, ideally with usage data on mind map creation
  and editing.

## Follow-up work

- If accepted, close #2447 and #2557, and update the WordPress plugin's bundled copy.
- Optional: measure how many existing projects contain `.exe-mind-map`.

## References

- #2447, #2556, #2557, #2558
- [#2482 comment on Sirena](https://github.com/exelearning/exelearning/pull/2482#issuecomment-6186453552)
- [Mermaid mindmap syntax](https://mermaid.js.org/syntax/mindmap.html)
- [`@erseco/mind-elixir-export-mermaid`](https://github.com/erseco/mind-elixir-export-mermaid), source of the inlined label escaping
