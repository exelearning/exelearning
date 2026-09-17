---
id: ADR-2440-01
title: "Render each in-line formula as one SVG: no MathJax in-line line breaking"
status: Proposed
date: 2026-09-17
tracking_issue: 2440
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
  - "@mnarvaezm"
  - "@ignaciogros"
related:
  prs: []
  changes: []
  adrs:
    - ADR-2259-01
    - ADR-2259-02
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5-1"
---

# ADR-2440-01: Render each in-line formula as one SVG: no MathJax in-line line breaking

## Context

Exports and the preview do not ship MathJax by default. The LaTeX in a page is
pre-rendered to static SVG plus hidden MathML while the export is generated:
`public/app/common/LatexPreRenderer.js` in the browser (the primary path, also used
by the preview) and `src/shared/export/prerender/ServerLatexPreRenderer.ts` on the
server (CLI commands and the external API). Both call MathJax once per formula and
serialise the result into `<span class="exe-math-rendered">`. The browser
pre-renderer keeps `node.querySelector('svg')`; the server one keeps the first
`<svg>…</svg>` match of a regular expression.

PR #2351 (`f20429451`) upgraded the vendored MathJax from 3.2.2 to 4.1.3
(ADR-2259-01). MathJax 4 enables in-line line breaking by default
(`output.linebreaks.inline: true`). With SVG output that changes the shape of the
result: an in-line formula is no longer one `<svg>` but one `<svg>` per break
opportunity (every top-level `=`, `+`, `\mid`, `\,`…), joined by `<mjx-break>`
elements so the browser can wrap between them. The split does not depend on the
available width: `makeBreaks = this.options.linebreaks.inline && !math.display`
(`node_modules/@mathjax/src/mjs/output/common.js:95`) and the fragments are emitted
for every opportunity, with the container width only deciding where the browser
wraps. Display formulas (`\[…\]`) are still one `<svg>`.

Neither pre-renderer knew about fragments, so every in-line formula reached the
preview and every export cut at its first break point: `\( x = 3 = 4 = 5 \)` showed
a lone `x`. Issue #2440 documents seven examples. The hidden MathML next to the SVG
still carried the whole formula, so screen readers read it correctly while sighted
readers saw a fragment.

## Problem

Should pre-rendered in-line formulas keep MathJax 4's fragment output, or should
MathJax be configured to emit a single `<svg>` per formula as 3.2.2 did?

## Decision drivers

- Correctness in every export format and in the preview, with the default project
  settings (no MathJax at runtime).
- One behaviour for the browser and the server pre-renderers, which must produce
  the same document (see `src/shared/export/prerender/mathjax-packages.ts`).
- Pre-rendered SVG is static: it cannot reflow after export, so browser-side
  wrapping of a formula is of limited value there.
- Backward compatibility with every export built before #2351, all of which carry
  one `<svg>` per formula, and with the CSS and tests written for that shape.
- Minimal, reviewable change.

## Options considered

### Option 1: Disable in-line line breaking in the MathJax configuration

Set `svg.linebreaks.inline: false` in the shared browser configuration
(`public/app/common/common.js`) and on the `SVG` output jax of
`ServerLatexPreRenderer`. MathJax emits one `<svg>` per in-line formula, which is
what both pre-renderers already expect.

- Pros: two one-line configuration changes; identical output on both paths;
  restores the 3.2.2 shape every existing export, stylesheet and test was built
  for; also applies to the editor and to exports with `pp_addMathJax`, so a
  formula looks the same in every context.
- Cons: long in-line formulas do not wrap at narrow widths. That is the behaviour
  eXeLearning always had before #2351, and authors can use display math for long
  expressions.

### Option 2: Keep every fragment in the pre-rendered output

Serialise the whole `mjx-container` (all `<svg>` fragments and the `<mjx-break>`
separators) instead of the first `<svg>`, in both pre-renderers.

- Pros: pre-rendered in-line formulas keep wrapping at narrow widths.
- Cons: the glyph `<defs>` live in the first fragment only, so the fragments are
  not independent; the `mjx-break` CSS (negative `letter-spacing`, the `MJX-ZERO`
  font) has to be copied into every export stylesheet and kept in step with the
  vendored MathJax; every consumer that assumes one `<svg>` inside
  `.exe-math-rendered` (EPUB, SCORM packaging, the export tests) has to be
  audited; the same logic has to be written twice, for the DOM and for the
  server's string output.

### Option 3: Wrap formulas in braces at import or save time

`\({x = 3 = 4 = 5}\)` has no top-level break point, so MathJax emits one `<svg>`
(workaround reported in #2440).

- Pros: no MathJax configuration change.
- Cons: rewrites author content; breaks `\ref`/`\label` and any macro that is not
  valid inside a group; papers over a rendering setting with a content transform.

## Evidence

- Issue #2440: reproduction table with seven in-line formulas and the fragment each
  one was cut to; confirmation that `pp_addMathJax: true` (MathJax at runtime,
  no pre-render) shows every formula in full.
- Reproduction against the vendored MathJax 4.1.3 with the configuration of
  `public/app/common/common.js` (2026-09-17, headless Chromium):
  `MathJax.tex2svgPromise('x = 3 = 4 = 5', { display: false })` returns a
  container with 4 `<svg>` elements, also with `containerWidth: 1280`; with
  `svg.linebreaks.inline: false` it returns 1 `<svg>` carrying the glyphs
  `𝑥=3=4=5`. `LatexPreRenderer.preRender('<p>\( x = 3 = 4 = 5 \)</p>')` kept the
  glyph `𝑥` alone before the change.
- `ServerLatexPreRenderer.preRender` on the same input kept the glyph `𝑥` alone:
  `src/shared/export/prerender/ServerLatexPreRenderer.spec.ts`, describe
  `inline line breaking (issue #2440)`, fails before the change and passes after.
- MathJax documentation, "Line breaking":
  <https://docs.mathjax.org/en/latest/output/linebreaks.html>, option
  `linebreaks.inline` ("true for browser-based breaking of in-line equations").
- MathJax source, `node_modules/@mathjax/src/mjs/output/common.js:95`
  (`@mathjax/src` 4.1.3): fragments are produced whenever
  `options.linebreaks.inline` is set and the math is not display.
- `public/app/common/LatexPreRenderer.js`, `renderLatexExpression`:
  `node.querySelector('svg')`; `src/shared/export/prerender/ServerLatexPreRenderer.ts`,
  `renderLatexExpression`: `/<svg[^>]*>[\s\S]*?<\/svg>/i`.

## Decision

We will set `svg.linebreaks.inline: false` in the shared browser MathJax
configuration and on the server pre-renderer's SVG output jax (Option 1). Every
in-line formula renders as a single `<svg>`, in the editor, in the preview and in
every export, on both pre-render paths.

## Consequences

### Positive

- In-line formulas are complete again in the preview and in HTML5, SCORM, IMS and
  EPUB exports, with the default project settings.
- The browser and the server pre-renderers produce the same markup for the same
  document.
- No change to the pre-renderers, the export stylesheets or the packaging code.

### Negative

- In-line formulas do not wrap at narrow widths. Long expressions should use
  display math, as before #2351.

### Neutral

- `pp_addMathJax` exports and the editor also stop wrapping in-line formulas,
  which keeps the rendering identical whether MathJax runs at export time or in
  the reader's browser.

## Risks

- A future MathJax upgrade could rename or move the option; the unit test on the
  browser configuration and the glyph-level server test fail loudly if it stops
  taking effect.
- A second configuration site (`public/app/common/edicuatex/js/edicuatex-tools.js`)
  keeps the default: the equation editor typesets live and only inserts LaTeX
  source, so fragments cannot leak into content. It should follow this ADR if it
  ever pre-renders.

## Validation

- `src/shared/export/prerender/ServerLatexPreRenderer.spec.ts`: one `<svg>`, no
  `<mjx-break>`, and every glyph of `x = 3 = 4 = 5`, `x^2 + y^2 = z^2` and
  `P(A \mid B) = 1` present in the output.
- `public/app/common/common_mathjax.test.js`: the shared configuration sets
  `svg.linebreaks.inline` to `false`.
- `test/e2e/playwright/specs/latex-rendering.spec.ts`, test "renders inline
  formulas with several break opportunities as one complete SVG (issue #2440)":
  the preview shows every glyph of the three formulas inside a single `<svg>`.

## Follow-up work

- If wrapping of long in-line formulas is ever requested, implement Option 2 on
  both pre-renderers behind a test that compares the browser and the server
  output, and supersede this ADR.

## References

- Issue #2440: Inline LaTeX `\( … \)` is truncated in preview and exports.
- PR #2351 (`f20429451`): upgrade MathJax to 4.1.3 and generate the vendored tree.
- ADR-2259-01: Generate the vendored MathJax tree from one pinned package.
- ADR-2259-02: MathML-first math accessibility.
- MathJax documentation, line breaking: <https://docs.mathjax.org/en/latest/output/linebreaks.html>
