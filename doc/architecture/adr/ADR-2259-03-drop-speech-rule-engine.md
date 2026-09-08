---
id: ADR-2259-03
title: "Weigh the Speech Rule Engine against the accessibility surface it does not cover"
status: Accepted
date: 2026-09-02
tracking_issue: 2259
deciders:
  - "@ignaciogros"
reviewers:
  - "@erseco"
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
  model: "claude-opus-5"
---

# ADR-2259-03: Weigh the Speech Rule Engine against the accessibility surface it does not cover

## Context

ADR-2259-02 settled the *floor*: hidden MathML (`a11y/assistive-mml`) is enabled
unconditionally, because it is the only path that needs no worker and no fetch, and
because NVDA, JAWS and VoiceOver convert MathML to speech themselves. That decision
is not reopened here.

This ADR is about the *ceiling* above that floor: the Speech Rule Engine (SRE), which
MathJax uses to turn an expression into words itself. SRE is what powers three menu
features and nothing else:

- the **expression explorer** — arrow-key navigation of subexpressions;
- **braille output** (Nemeth) for a refreshable braille display;
- **Auto Voicing**, which reads the generated words through `window.speechSynthesis`.

The question was deferred rather than answered when the MathJax 4 upgrade was
prepared: the upgrade shipped SRE because that is the conservative choice, and asked
for a reviewer's call. Two things have changed since, both of which move the numbers:

1. The upgrade turned out to need the font's glyph ranges vendored as well
   (`\mathbb`, `\mathcal`, `\mathfrak`, stretchy arrows), because MathJax 4 keeps
   them outside the combined component and resolves them through a CDN by default.
   That adds 1.42 MB to the same directory, so the directory is now the most
   expensive thing in a math export rather than a rounding error.
2. `exe_math/` is copied wholesale into **every** export whose content matches
   `/\\\(|\\\[/` — every export containing LaTeX, not only those that opted into the
   runtime MathJax library. So each byte here is a byte in each package a teacher
   distributes.

Meanwhile eXeLearning has a second, independent accessibility feature that covers
the whole document rather than its formulas: the accessibility toolbar
(`public/libs/exe_atools`, `pp_addAccessibilityToolbar`), which offers larger and
smaller text, uppercase mode, a dyslexia-friendly font, a dark/high-contrast mode,
a translate button and **read-aloud over the whole page**. The two features compete
for the same budget in the same ZIP.

## Problem

Do we ship the Speech Rule Engine in the vendored MathJax tree, given that it costs
roughly four times the accessibility toolbar, serves only formulas, only where there
is a network, and has been broken for eight months without a single report?

## Decision drivers

- **Who is actually served.** Screen-reader users get maths from the hidden MathML
  floor either way (ADR-2259-02). SRE adds the explorer, braille and Auto Voicing.
- **Where it works.** SRE builds a worker from a `blob:` URL that calls
  `importScripts()` and then fetches a locale map. None of that survives a document
  opened from the filesystem, which is how an extracted HTML5 zip, an EPUB or an
  unpacked SCORM package is read (ADR-2259-02).
- **Cost per package, not per install.** The tree ships inside every math export.
- **Accessibility budget is finite.** A megabyte spent on formula speech is a
  megabyte not spent on the toolbar that covers every page.
- **Evidence of demand.** Eight months broken, zero reports.
- **Diff complexity.** Keeping SRE requires reaching into MathJax's internal `_`
  namespace to trim the language menu; dropping it uses the menu's own
  `findID`/`hide`, like the renderer entry already does.
- **The issue's own acceptance criteria.** Issue #2259 asks for the explorer to
  activate and for speech strings per locale. Dropping SRE does not satisfy that
  text; it replaces it.

## Options considered

### Option 1: Ship SRE with a bounded set of locales (what the upgrade currently does)

Vendor `a11y/{sre,explorer,speech,semantic-enrich,complexity}.js`,
`sre/speech-worker.js` and eight `sre/mathmaps/*.json` (`base`, `euro`, `nemeth` plus
`ca`, `de`, `en`, `es`, `it`), and trim MathJax's language submenu to what ships.

**Pros**

- Satisfies #2259 as written: the explorer activates, braille works, no console error.
- Restores a feature that existed, on paper, before the partial revert.
- No menu sections need hiding beyond the language list.

**Cons**

- 2,668,043 B raw / ~469 KB in the release ZIP, in every math export.
- Works only over HTTP. The most common offline consumption paths — an extracted
  HTML5 export, an EPUB, an unpacked SCORM package, the Electron app reading a
  local file — get nothing from it.
- Duplicates, for formulas only, what the platform screen reader already does from
  the MathML, and what the accessibility toolbar's read-aloud does for the whole page.
- Braille is the only genuinely non-duplicated capability, and it is braille for the
  formulas of a document whose prose is not brailled.
- Requires `trimSpeechLocaleMenu()`, which reads `MathJax._.a11y.sre_ts.locales` —
  an internal namespace with no compatibility promise.
- Only 5 of eXeLearning's 11 interface languages have speech rules at all
  (`eo`, `eu`, `gl`, `pt`, `ro`, `va` have none), so the feature is unevenly
  available across the user base by construction.

### Option 2: Drop SRE, keep hidden MathML as the floor (recommended)

Remove the six SRE-dependent files and the eight mathmaps from the vendored tree.
Hide the Speech, Braille, Explorer/Activate and Collapsible menu sections the same
way the Math Renderer entry is already hidden. Close #2259 by recording that hidden
MathML is the answer, not the explorer.

**Pros**

- −2,668,043 B raw / −469,461 B zipped from `exe_math/`, in every math export.
  The directory drops to 4,490,045 B raw / 1,530,496 B zipped, which is 324 KB
  *below* the broken tree on `main` rather than 145 KB above it.
- Removes the reach into `MathJax._`; the menu work becomes documented API.
- No capability regression for the path that actually reaches blind learners: the
  MathML floor is unchanged, and it is the only path that works offline.
- Aligns the accessibility spend with the feature that covers the whole document.

**Cons**

- Loses braille output for formulas. This is a real loss, not a cosmetic one, for a
  reader with a refreshable display — even though it only ever worked online, only
  in five languages, and has not worked at all since January.
- Loses arrow-key exploration of large expressions, which is genuinely useful for
  long formulas and has no MathML equivalent.
- Contradicts the acceptance criteria written into #2259, so it needs the issue
  author's agreement rather than an implementer's judgement.
- Four menu sections must be hidden, and hiding is a UI removal: AGENTS.md forbids
  removing UI options without an explicit decision. This ADR is that decision.

### Option 3: Ship SRE with `en` only

Vendor `base`, `euro`, `nemeth` and `en`, dropping `ca`, `de`, `es`, `it`.

**Pros**

- Keeps explorer and braille for about 1.5 MB less than Option 1.

**Cons**

- Announces Spanish maths in English to a Spanish-language authoring tool's users.
  That is worse than no speech, because a screen reader reading the MathML would at
  least use the reader's own language.
- Keeps every structural cost of Option 1 (worker, internal-namespace menu trim,
  offline hole) for a fraction of the benefit.

### Option 4: Load SRE from a CDN on demand

Leave `loader.paths` pointing at jsdelivr for the SRE components only.

**Pros**

- Zero bytes in the package.

**Cons**

- Rejected on the same grounds as the font ranges: an external request from
  published educational content, dead offline, a third-party dependency in a
  WordPress.org plugin (guideline 8), and a privacy leak from a learner's browser.
  Not viable.

### Option 5: Keep SRE in the editor, strip it from the export copy

Vendor SRE, but exclude `sre/` and the SRE-dependent `a11y/*` from the directory
copied into exports.

**Pros**

- Export weight of Option 2 with the editor capability of Option 1.

**Cons**

- The explorer serves *readers* of a published package, not authors in the editor,
  so this keeps the cost exactly where the feature has no audience and removes it
  exactly where it might have one. It optimises the wrong side.
- `LIBRARY_PATTERNS` copies the directory wholesale
  (`src/shared/export/constants.ts`); a per-file export filter is new machinery to
  maintain for a feature we are unsure we want.

## Evidence

Byte counts measured on `feature/upgrade-to-mathjax-4` after the font fix; ZIP
figures are `zip -r` over the directory, the same deflate the release ZIP uses.

| Component | raw |
|---|---:|
| `sre/speech-worker.js` | 425,256 |
| `sre/mathmaps/*.json` (8 locales) | 1,886,008 |
| `a11y/sre.js` | 261,018 |
| `a11y/explorer.js` | 57,864 |
| `a11y/speech.js` | 20,451 |
| `a11y/semantic-enrich.js` | 4,782 |
| `a11y/complexity.js` | 12,664 |
| **SRE total** | **2,668,043** |

| `exe_math/` state | files | raw | ZIP |
|---|---:|---:|---:|
| `main` (3.2.2/4.0 mix, explorer broken) | 85 | 8,628,066 | 1,854,484 |
| MathJax 4 + vendored font assets, with SRE | 87 | 7,158,088 | 1,999,957 |
| MathJax 4 + vendored font assets, without SRE | 70 | 4,490,045 | 1,530,496 |

For comparison, the accessibility toolbar that covers every page of a project —
text size, uppercase, dyslexia-friendly font, contrast mode, translate, read-aloud —
is 649,844 B raw / 629,435 B zipped across 14 files (`public/libs/exe_atools`,
excluding its test). Formula-only speech costs **4.1× the raw weight** of the
whole-document toolbar.

Other facts:

- `exe_math/` is copied into every export whose content matches `/\\\(|\\\[/`
  (`LIBRARY_PATTERNS`, `src/shared/export/constants.ts`), independently of the
  `pp_addMathJax` property.
- The explorer has been unusable since `9272d5c67` (2026-01-03) — the partial
  revert that left 4.0.0 components under a 3.2.2 loader. Issue #2259 was opened on
  2026-08-14 from a code audit, not from a user report; the issue and this branch
  are the only places it is mentioned.
- SRE's runtime requirements (`blob:` worker → `importScripts()` → locale fetch) do
  not survive a `file://` document; measured and recorded in ADR-2259-02.
- Speech rules exist for `af ca da de en es fr hi it ko nb nn sv`. Of eXeLearning's
  interface languages, `eo`, `eu`, `gl`, `pt`, `ro` and `va` have none.
- `trimSpeechLocaleMenu()` in `public/app/common/common.js` reads
  `MathJax._.a11y.sre_ts.locales`, an internal namespace, because MathJax builds the
  language submenu from a Map baked into the bundle rather than from what is on disk.

## Decision

**We will take Option 2: drop the Speech Rule Engine and keep hidden MathML as the
floor.** Ruled by the maintainers on 2026-09-02, on a review that agreed with removing
braille. Braille alone was not the lever: `nemeth.json` deflates to **19,550 B of the
release ZIP** out of the engine's 469,461 B, and removing it leaves every structural
cost in place — the worker, the seven remaining maps, the reach into `MathJax._`, and
the toggle that can switch the accessibility floor off. The argument accepted for
braille — the assistive technology already turns MathML into braille, MathJax only
adds the last translation step — applies unchanged to speech, so the two were decided
together.

`sre/` and `a11y/{sre,explorer,speech,semantic-enrich,complexity}.js` are removed from
the vendored tree. Because speech is compiled into the combined component, deleting
the files is not sufficient: `enrich`, `speech`, `braille` and `collapsible` are set to
`false` in `options.menuOptions.settings` — menu settings rather than document options,
because the document constructor writes the menu's values back over the document's —
and the Speech, Braille, Explorer and Math Renderer menu sections are hidden by id.
`forgetUnavailableMenuSettings()` also drops those keys if a reader carries them in
`localStorage` from before the removal.

Verified in a browser on the resulting build: `enableSpeech`, `enableBraille`,
`enableExplorer` and `enableEnrichment` all `false`; `enableAssistiveMml` `true` with
one `mjx-assistive-mml` per formula; all four menu sections hidden; and **zero requests
for any removed component**.

## Consequences

### Positive

- `exe_math/` lands below the current `main` in both raw and ZIP terms while being
  consistent and complete for the first time since January, and every math export
  gets ~469 KB smaller.
- **The accessibility floor becomes a structural invariant.** ADR-2259-02 promised
  hidden MathML but MathJax models it as an alternative to speech, and toggling Speech
  in the menu switched it off and persisted that per origin. With no speech in the
  menu there is nothing to trade it against.
- The MathJax menu stops offering three features whose runtime dependencies we would
  not be shipping, which is the same class of defect as the CHTML renderer entry and
  the untrimmed language list.
- Accessibility claims in the UI become checkable: what remains is what works
  everywhere, including offline.

### Negative

- Formula braille and expression exploration are gone from eXeLearning until someone
  asks for them. Reinstating them means re-vendoring ~2.7 MB and restoring four
  settings — the ADR records exactly which, so it is a small change, not an
  archaeology exercise.
- The `pp_addMathJax` help text no longer has an accessibility angle to sell, which
  is part of why it was rewritten to name no features (`src/routes/config-params.ts`).

### Neutral

- Under either option the hidden-MathML floor, ADR-2259-02 and the vendoring
  mechanism of ADR-2259-01 are unchanged.
- Under either option the vendored font glyph ranges stay: they are orthogonal to
  speech and required for correctness offline.

## Risks

- **A braille user exists and has not reported it.** Likelihood unknown; the feature
  has been broken since January, so their experience does not change on merge, but a
  deliberate removal is harder to reverse than an accident. Mitigated by recording
  the exact restoration cost here.
- **The decision is read as "eXeLearning does less accessibility".** It is the
  opposite — the floor is now unconditional and works offline, where the removed
  ceiling never did — but the framing needs care in the release notes.
- ~~**Rejecting Option 2 leaves `exe_math/` above `main`.**~~ Resolved: the tree is
  now below `main` in both measures.

## Validation

- If Option 2 is chosen: `vendor-mathjax.spec.ts` pins the absence of the SRE files
  and mathmaps; a Playwright spec asserts the Accessibility submenu offers no entry
  that would request a file the tree does not contain; the hidden-MathML assertion
  already added to `latex-rendering.spec.ts` keeps the floor honest.
- Either way, verify what the accessibility toolbar's read-aloud announces for a
  page containing formulas. If it reads the hidden MathML usefully, the
  whole-document path covers formulas too and the case for Option 2 strengthens; if
  it skips them, that is a toolbar bug worth its own issue and a better use of the
  budget than SRE.
- Revisit if a user reports missing braille or expression navigation.

## Follow-up work

- Close #2259 with the reasoning rather than the implementation: the answer to
  "restore interactive math speech" is that hidden MathML is the answer.
- Check the accessibility toolbar's read-aloud against formulas (see Validation). If
  it reads the hidden MathML usefully, the whole-document path covers formulas too; if
  it skips them, that is a toolbar bug and a better use of the budget than SRE was.
- Re-check the hidden menu ids on the next MathJax upgrade.

## References

- Issue #2259 — Interactive math speech/explorer is broken by the MathJax 3.2.2/4.0
  version mix
- PR ateeducacion/exelearning#43 — MathJax 4.1.3 upgrade and generated vendored tree
- PR exelearning/exelearning#2260 — static size reduction, which removes the same
  files to make the tree consistently 3.2.2
- Issue #1542 — plugin size for WordPress.org
- ADR-2259-01 — Generate the vendored MathJax tree from one pinned package
- ADR-2259-02 — Make hidden MathML the math accessibility floor and bound the speech
  locales
- `9272d5c67` — the partial revert that broke the explorer
- `src/shared/export/constants.ts` — `LIBRARY_PATTERNS`, which copies `exe_math/`
  into every export containing LaTeX
- `public/libs/exe_atools` — the whole-document accessibility toolbar
