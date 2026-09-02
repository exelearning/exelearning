---
id: ADR-2259-02
title: "Make hidden MathML the math accessibility floor and bound the speech locales"
status: Proposed
date: 2026-08-30
tracking_issue: 2259
deciders:
  - "@erseco"
reviewers:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs:
    - ADR-2259-01
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-sonnet-5"
---

# ADR-2259-02: Make hidden MathML the math accessibility floor and bound the speech locales

## Context

MathJax turns an expression into something a screen reader can announce in two
different ways, and they have very different runtime requirements.

**Hidden MathML** (`a11y/assistive-mml`, 4 KB) puts a `<math>` element next to the
visual output and marks the SVG `aria-hidden`. NVDA, JAWS and VoiceOver convert that
MathML to speech themselves. It needs no network and no worker.

**Speech-Rule-Engine speech** turns the expression into words inside MathJax
(`sre/speech-worker.js` plus a per-language `sre/mathmaps/<locale>.json`), which the
system then voices. It powers the expression explorer — arrow-key navigation of
subexpressions, braille output, and the "Auto Voicing" menu entry that reads through
`window.speechSynthesis`.

MathJax 3 enabled assistive MathML by default and left the explorer off. MathJax 4
reverses this: the combined components bundle the speech, explorer and
semantic-enrich extensions and enable them, and assistive MathML defaults to off
(<https://docs.mathjax.org/en/latest/upgrading/whats-new-4.0/ui.html>).

eXeLearning exports are frequently opened from the filesystem — an extracted HTML5
zip, an EPUB reader, a SCORM package unpacked locally. MathJax 4 builds its speech
worker from a `blob:` URL that calls `importScripts()` on the vendored worker and
then fetches the locale map, neither of which a `file://` document can do.

Issue #2259 asks for the explorer to work "for each locale". MathJax ships 13 speech
locales; eXeLearning's interface exists in 11 languages, of which SRE supports five
(`ca`, `de`, `en`, `es`, `it`). The other six — `eo`, `eu`, `gl`, `pt`, `ro`, `va` —
have no speech rules at all.

## Problem

Which accessibility path do we guarantee in an exported package, and how many speech
locales do we ship given each one costs about 250 KB in every export that contains
mathematics?

## Decision drivers

- A blind learner must be able to read the mathematics in an export opened offline.
- Accessibility must not depend on a feature that silently fails in the delivery
  format most learners receive.
- Every locale map ships in every math export.
- The contextual menu must not offer something that breaks when chosen.

## Options considered

### Option 1: MathJax 4 defaults (speech on, assistive MathML off)

- Pro: no configuration; the explorer is available immediately online.
- Con: an export opened from `file://` gets neither speech nor hidden MathML, so a
  screen reader announces nothing at all. This is a regression against v3 for the
  offline case.

### Option 2: Drop SRE entirely, hidden MathML only

Delete `sre/` (2.2 MB) and hide the Speech, Braille and Explorer menu sections.

- Pro: smallest tree, 3.7 MB. Screen readers still work everywhere.
- Pro: the explorer has been dead since `9272d5c67`, so nothing in use is lost.
- Con: loses arrow-key exploration and braille, which #2259 explicitly asks for.
- Con: needs three menu sections hidden, or the Speech toggle stalls the typeset
  queue (measured below).

### Option 3: Hidden MathML always, plus SRE for the locales eXeLearning speaks

Enable `a11y/assistive-mml`, and vendor the five speech locales that overlap the
interface languages plus the `base`, `euro` and `nemeth` support maps.

- Pro: the offline floor holds everywhere; the explorer works online in the languages
  the product is actually used in.
- Con: 2.2 MB of locale data in every math export.
- Con: MathJax offers all 13 languages in its menu regardless of what is on disk, so
  the menu has to be trimmed.

## Evidence

- **The worker cannot start from `file://`.** `core.js` builds the worker as
  `URL.createObjectURL(new Blob(["self.maps='…'; importScripts('…/speech-worker.js');"]))`
  and passes it to `new Worker()`. A `blob:` worker created by a `file://` document
  has an opaque origin and cannot `importScripts` a `file://` URL.
- **A missing locale map hangs typesetting.** Vendoring 8 maps and then selecting
  French from the menu produced `GET /exe_math/sre/mathmaps/fr.json 404`, after which
  `MathJax.typesetPromise()` never settled — measured at a 10 s race timeout, with
  `speechError` never invoked. Already-rendered content survived; anything queued
  afterwards did not render.
- **The menu ignores what is on disk.** `ui/menu.js` builds the language submenu from
  `MathJax._.a11y.sre_ts.locales`, a Map baked into the bundle. With five maps
  vendored it still offered `af, ca, da, de, en, es, fr, hi, it, ko, nb, nn, sv`.
- **Trimming that Map works and is enough.** Deleting the unshipped keys in
  `startup.ready()` left the menu offering exactly `ca, de, en, es, it` (plus the
  `euro` and `nemeth` support maps, which MathJax already excludes from the language
  list), with rendering unaffected.
- **Speech itself works once vendored.** With the maps in place and
  `sre.locale = 'es'`, MathJax produced
  `<say-as interpret-as="character">a</say-as> al cuadrado más …` and the Nemeth
  braille `⠁⠘⠆⠐⠬⠃⠘⠆⠀⠨⠅⠀⠉⠘⠆`, with no errors and the worker path resolved
  automatically from `loader.paths.mathjax`.
- **Sizes measured** for `exe_math/`: 3.7 MB with no SRE, 4.8 MB with English only,
  5.9 MB with five languages, 8.2 MB with all sixteen maps. `main` today is 8.4 MB.

## Decision

We will enable `a11y/assistive-mml` and `enableAssistiveMml: true` in every context,
making hidden MathML the guaranteed accessibility path — it is the only one that
survives an export opened from the filesystem.

We will vendor the speech-rule maps for `ca`, `de`, `en`, `es` and `it`, plus the
`base`, `euro` and `nemeth` support maps, keeping the expression explorer, braille
and Auto Voicing working in the languages eXeLearning is translated into.

Because MathJax offers every language its bundle knows about rather than the ones
present on disk, `$exe.math.trimSpeechLocaleMenu()` removes the unshipped languages
from `MathJax._.a11y.sre_ts.locales` in `startup.ready()`. The list lives in
`window.MATHJAX_SPEECH_LOCALES` in `common.js`, and a test asserts it equals
`VENDORED_SRE_LOCALES` in `scripts/vendor-mathjax.ts`.

The speech locale defaults to the document's `lang` when we ship rules for it, and to
English otherwise.

### What this decision does not guarantee

The word "guaranteed" above describes intent, not a structural invariant, and the
difference was measured after the decision was first written. MathJax does not model
hidden MathML as a floor beneath speech: it models the two as alternatives. In
`tex-mml-svg.js`, `setSpeech(true)` calls `setValue(false)` on the `assistiveMml`
variable and `setAssistiveMml(true)` turns speech off, and `applySettings()` copies the
menu's value over `document.options.enableAssistiveMml` on every page load.

Reproduced in Chrome against this branch: on a clean profile the floor holds
(`enableAssistiveMml: true`, one `mjx-assistive-mml` per formula). Toggling Speech off
and back on in the contextual menu leaves `{"assistiveMml":false}` in `localStorage`
and **zero** `mjx-assistive-mml` nodes for two formulas. The key is scoped to the
origin, so it follows the reader from one package to the next on the same LMS, and in
an export opened from the filesystem speech cannot start either — leaving no accessible
maths at all, silently.

`$exe.math.forgetUnavailableMenuSettings()` therefore drops a stored
`assistiveMml: false` before `defaultReady()`, alongside the stored renderer. That
turns the floor back into something the page enforces rather than something the reader
can switch off by accident. It is a mitigation, not a proof: while SRE ships, the
guarantee is "restored on every load", not "impossible to lose". Dropping SRE
(ADR-2259-03, Option 2) would make it an invariant, because the menu would no longer
offer the toggle that trades one for the other.

### Relationship with MathJax's own recommendation

This decision goes against the direction upstream took, and that is deliberate.
MathJax 4 turned assistive MathML off by default and made speech the primary path
because assistive-technology support for MathML is uneven across browsers and screen
readers — a fair reading of the web they optimise for.

We have a constraint MathJax does not: eXeLearning does not publish pages, it publishes
packages. An extracted HTML5 export, an EPUB, an unpacked SCORM package on an isolated
LMS and the Electron app are all read without a network, and MathJax's speech path
cannot start there at all (`blob:` worker → `importScripts()` → locale fetch). In that
delivery model uneven MathML support beats no output whatsoever, so the trade-off
upstream makes correctly for served pages inverts for us. A reviewer reading the
MathJax 4 documentation should find this stated rather than have to reconcile it.

## Consequences

### Positive

- Screen readers announce mathematics in every delivery format, including an export
  opened from disk, which MathJax 4's defaults would not have done.
- The explorer and braille work again for the first time since `9272d5c67`.
- No menu entry can be chosen that wedges typesetting.
- 2.2 MB smaller than shipping all sixteen locale maps.

### Negative

- `trimSpeechLocaleMenu()` reaches into `MathJax._`, an internal namespace, so a
  MathJax upgrade could change or remove it. It fails closed: the function returns
  `false` and the menu keeps its full list rather than throwing.
- A reader whose language is `eo`, `eu`, `gl`, `pt`, `ro` or `va` gets English in the
  explorer. Their screen reader still reads the MathML in their own language.

### Neutral

- Assistive MathML adds a `<math>` element per expression to exported HTML.

## Risks

- **`MathJax._.a11y.sre_ts.locales` disappears in a future MathJax release.** Then the
  menu offers all 13 languages again and eight of them hang if chosen. Mitigated by
  the guard, but a MathJax upgrade should re-run the locale check.
- **A locale is added to one list and not the other**, re-creating the hang. Covered
  by the parity test in `mathjax-packages.spec.ts`.
- **The floor is restored per load, not enforced.** A reader who turns Speech on mid
  session loses the hidden MathML for the rest of that page view; it comes back on the
  next load. Removing SRE closes this; while it ships, the window stays open.

## Validation

- `public/app/common/common_mathjax.test.js` — 10 tests covering the configuration
  and every branch of `trimSpeechLocaleMenu()`.
- `src/shared/export/prerender/mathjax-packages.spec.ts` — locale list parity.
- `test/e2e/playwright/specs/latex-rendering.spec.ts` asserts every rendered formula
  carries hidden MathML.
- `common_mathjax.test.js` covers dropping a persisted `assistiveMml: false`.
- Not covered by an automated test: the mid-session Speech toggle, because it needs a
  real contextual menu and the state it produces is exactly the one the load-time
  cleanup removes. Verified by hand, recorded above.

## Follow-up work

- Re-check the locale trim on the next MathJax upgrade.
- If export size becomes the priority, Option 2 (drop SRE, 3.7 MB) remains available
  and costs only the explorer, which no released build has ever had working.

## References

- Issue #2259
- <https://docs.mathjax.org/en/latest/upgrading/whats-new-4.0/ui.html>
- <https://docs.mathjax.org/en/latest/options/accessibility.html>
- ADR-2259-01 — how the tree that carries these files is generated
