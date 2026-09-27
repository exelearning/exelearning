---
id: ADR-2467-01
title: "Future rich-text editor strategy"
status: Proposed
date: 2026-09-27
tracking_issue: 2467
deciders:
  # Filled in when the team accepts or rejects this record.
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@mnunezcedec"
  - "@franmate"
related:
  prs: [1593, 2463, 2464, 2467]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2467-01: Future rich-text editor strategy

> **This record proposes; it does not decide.** Its purpose is to give the team one
> place with the evidence, the estimates and the trade-offs, so that the choice of
> eXeLearning's rich-text editor can be discussed in
> [PR #2467](https://github.com/exelearning/exelearning/pull/2467) and recorded here
> once there is consensus.

## How to read this record

Every statement is one of three kinds, and is labelled when it matters:

- **[FACT]**: observed in this repository at `f64d72fb5` (the `main` this branch starts
  from), reproduced by [`scripts/analyze-editor-debt.mjs`](../../../scripts/analyze-editor-debt.mjs),
  or read from a cited external source.
- **[EST]**: an engineering estimate. Effort figures are never implementation
  measurements.
- **[OPINION]**: technical judgement by the authors of this record.
- **UNVERIFIED**: could not be confirmed; do not rely on it without checking.

All external sources were checked on **2026-09-27** unless another date is given.
npm facts come from `npm view <package>` (<https://www.npmjs.com/>); GitHub advisories
from `gh api repos/<owner>/<repo>/security-advisories`.

## Context

eXeLearning edits most of its content, the HTML inside iDevices, with a TinyMCE 5
build committed under `public/libs/tinymce_5/` together with 24 eXe-specific plugins.
The same static build is embedded by the WordPress plugin
[wp-exelearning](https://github.com/exelearning/wp-exelearning), by the Moodle and
Omeka S integrations, by the Electron desktop app and by the offline/PWA build.

Three pull requests forced the question this record answers:

- **#1593** (open): replaces committed third-party libraries with dependencies
  declared in `package.json` and copied at build time. Whatever editor is chosen
  should be consumed through that pipeline.
  <https://github.com/exelearning/exelearning/pull/1593>
- **#2464** (closed 2026-09-27): bumped Bootstrap, jQuery UI and TinyMCE to 5.10.9.
  The TinyMCE part was put on hold until the team decides the editor strategy here.
  <https://github.com/exelearning/exelearning/pull/2464>
- **#2463** (closed 2026-09-27): removed the `codemagic` plugin and its CodeMirror 3.
  It was closed because removing it is a visible regression; the alternative, a
  modernised CodeMagic, has to be argued. That is done in *CodeMagic strategy* below.
  <https://github.com/exelearning/exelearning/pull/2463>

In addition, WordPress.org reviewers questioned the libraries that wp-exelearning
bundles (Guideline 13, see *WordPress distribution considerations*). No reviewer
statement about TinyMCE specifically exists; anything this record says about how a
reviewer would react is **[OPINION]**.

## Problem

Which rich-text engine should eXeLearning use for the next several years, how should
it be delivered, and how should the move away from TinyMCE 5 be sequenced, given that
TinyMCE 5 no longer receives free security fixes and eXe's editor is coupled to it far
beyond the public API?

## Current architecture

**Loading [FACT]:**

| Context | How TinyMCE is loaded |
|---|---|
| Web/server workarea | `views/workarea/workarea.njk:64-65`: `tinymce.min.js` and `tinymce_5_settings.js` through the `asset` filter |
| Static/PWA build (WordPress, Electron, offline) | `scripts/static-bundle/static-index.html:348-349` |
| interactive-video iDevice | A second, independent TinyMCE instance written with `document.write` (`edition/editor/index.html:99`) |
| Vitest | `public/vitest.setup.js:940-991` evaluates the real core into jsdom |

**Instantiation [FACT]:** iDevices render `<textarea class="exe-html-editor">` and
`$exeTinyMCE.init('multiple-visible', '.exe-html-editor')` turns them into editors.
`$exeTinyMCE` is an eXe object in `public/app/editor/tinymce_5_settings.js` (1,087
lines) that owns the configuration, the Media Library hooks and the `asset://`
handling. Six iDevice files go through `$exeTinyMCE.init`; six others call
`tinymce.init` directly with their own configuration (guess, interactive-video,
map, quick-questions, quick-questions-multiple-choice, trivial). That is **12 init
sites plus the interactive-video second instance**; 44 iDevice files mention TinyMCE.

**The editor contract seen by iDevices [FACT]** (script output, non-test files): 279
`tinyMCE.get(`, 20 `tinymce.get(`, 27 `tinymce.editors`. In practice iDevices use
`get(id).getContent()/setContent()/save()`, `editors[]`, `init` and `remove`.

**Core [FACT]:** the bundled core is **TinyMCE 5.10.2 (2021-11-17)**, byte-identical
to `npm pack tinymce@5.10.2`, as are the theme, icons, skins and 20 upstream plugins.
There are no core patches.

**Plugins [FACT]** (`public/libs/tinymce_5/js/tinymce/plugins/`, 44 directories):

- **20 upstream, unmodified**: advlist, anchor, autolink, autoresize, charmap, code,
  directionality, fullscreen, hr, image, insertdatetime, link, lists, paste, preview,
  searchreplace, table, textcolor, visualblocks, visualchars.
- **4 eXe forks of core plugins**, each from a different upstream patch level:
  `exeimage` (image@5.10.2), `exelink` (link@5.10.3), `exemedia` (media@5.10.3) and
  `template` (template@5.10.5, keeps the upstream name).
- **20 eXe-own**: abbr, abcmusic, addcontent, blockquoteandcite, clearfloat,
  codemagic, definitionlist, easyattributes, edicuatex, exealign, exeaudio, exeeffects,
  exegames_hangman, exemermaid, exemindmap, modalwindow, pastecode, rssfeed,
  toggletoolbars, tooltips.

The main configuration enables 40 plugins; the six direct-init iDevices add
`autoresize code image link lists paste textcolor`. Every shipped plugin is referenced
by some configuration.

**Collaboration [FACT]:** Yjs syncs pages, blocks and whole iDevices. Editing an iDevice
takes an exclusive lock (`public/app/yjs/YjsLockManager.js`); the editor's HTML is
written to Yjs as one string when the iDevice is saved
(`YjsStructureBinding.updateComponent()`, `public/app/yjs/YjsStructureBinding.js:2080-2178`).
Character-level co-editing does not exist: the unused TinyMCE binding was deleted in
`dfdd7cd9f` (PR #2267) and issue #2169 decided it should not be activated
(<https://github.com/exelearning/exelearning/issues/2169>). In static mode, which
wp-exelearning uses, collaboration is disabled (`public/app/core/Capabilities.js`).

## Current technical debt

![Current TinyMCE 5 technical debt in eXe plugins](assets/editor-comparison/4-technical-debt.svg)

*How chart 4 was computed [FACT]:* `node scripts/analyze-editor-debt.mjs` walks the 24
non-upstream plugin directories, strips comments and counts regex matches per plugin;
a bar counts the plugins with at least one match. "Direct DOM access" means
`getBody()/getDoc()/…`, `document.querySelector/createElement/write`, `innerHTML`,
`outerHTML`, `contentWindow` or `contentDocument`. "Direct tinymce global access" is
any `tinymce.X`/`tinyMCE.X` other than `PluginManager.add`. The exact regexes are in
the script's `METRICS` table. They are indicators, not an AST analysis.

**Size and tests [FACT]:** eXe plugin code (own plus forks, vendored libraries excluded)
is **15,908 non-blank lines**, with **1,147 lines of colocated tests**. Only 7 of the 24
plugins have a test file (codemagic, definitionlist, exeimage, exemedia, exemermaid,
exemindmap, pastecode); `exelink` (2,312 lines) and `tooltips` (938 lines) have none.
Earlier drafts quoted "~22,000" or "~16k" lines; those counted raw lines including
the vendored jQuery and Cropper inside exemindmap. This record uses the script's figure.

**Coupling totals across the 24 plugins [FACT]:**

| Coupling | Count | Why it matters |
|---|---|---|
| `.tox-*` UI selectors | 133 | Pin TinyMCE 5's DOM; also 7 in `public/app`, SCSS and E2E |
| TinyMCE internal markers (`data-mce-*`, `mce-object`, …) | 111 | Internal, some persisted in content |
| `tinymce.util.*` / `tinymce.dom.*` internals | 49 | Not public API |
| APIs removed or renamed in TinyMCE 6 | 26 | `DomQuery`, `util.XHR/Promise`, `.settings`, `getParam`, `.fire`, toolbar names |
| `activeEditor` | 40 | Fragile with several editors per iDevice |
| `tinymce.DOM` static helper | 259 | Global helper |
| jQuery matches | 295 | Couples plugins to the host page |
| `parent.` / `top.` reach-arounds | 24 | 18 of them in exemindmap |
| `windowManager.openUrl` iframe dialogs | 4 | codemagic, edicuatex, abcmusic, exemindmap |

**Content-format coupling [FACT]:** `data-mce-html="true"` and `data-mce-pdf="true"`
are written into saved content (`AssetManager.js`, `modalFileManager.js`,
`tinymce_5_settings.js`; 9 and 2 occurrences in application code) and read back at
render time (`asset_url_resolver.js` selects `iframe[data-mce-html]`). Export code
detects classes that plugins emit (`exe-fx`, `exe-tooltip`, `highlighted-code`,
`abc-music`; `src/shared/export/constants.ts`). Editor output is therefore a public
format contract, not a private detail.

**Other couplings [FACT]:**

- `tinymce_5_settings.js` monkey-patches `editor.windowManager.open` (`_patchAssetDialogs`)
  to rewrite `blob:` to `asset://` inside the exeimage/exemedia dialog specs, and walks
  TinyMCE's internal `span.mce-preview-object[data-mce-p-src]` placeholder.
- `public/libs/abcjs/exe_abc_music.js:241` hard-codes
  `tinymce_5/js/tinymce/plugins/abcmusic`; `public/app/yjs/ResourceFetcher.js:52`
  lists `tinymce_5`. A runtime library depends on the editor's folder layout.
- Two iframe sub-apps live inside plugin folders and bring old libraries:
  codemagic (CodeMirror 3.21.1 plus `batched_scripts.js`) and exemindmap (jQuery 1.6.1
  at runtime, jQuery UI 1.8, jquery.tmpl). Both need Bun routes
  (`/api/codemagic-editor/*`, `/api/exemindmap-editor/*` in `src/index.ts`).
- `exegames_hangman` and `rssfeed` register buttons, but neither name appears in any
  toolbar, menu or context menu. **[OPINION]** candidates for deletion, not migration;
  UNVERIFIED whether another entry point exposes them.
- Tests: 17 Vitest files, 26 Playwright specs/helpers and 1 Bun spec touch TinyMCE or
  `.tox-*`; `tinymce_5_settings.test.js` alone is 2,727 lines and asserts the pruning of
  the vendored tree (lines 2670-2727).
- `public/app/common/common_edition.js:67-68` still branches on
  `tinymce.majorVersion == 4 / 3`; neither branch runs under 5.

**Upstream security status [FACT]:** 11 published TinyMCE advisories affect 5.10.2
(<https://github.com/tinymce/tinymce/security/advisories>):

| Advisory | Severity | Fixed for free in |
|---|---|---|
| GHSA-q742-qvgc-gc2f (CVE-2026-47759, `data-mce-` src/href/style) | high | 7.9.3, 8.5.1 (5.x only in paid 5.11.1) |
| GHSA-vg35-5wq7-3x7w (CVE-2026-47761, media `data-mce-object`) | high | 7.9.3, 8.5.1 (5.x only in paid 5.11.1) |
| GHSA-v98h-vmpc-fpqv (CVE-2026-47762, `mce:protected`) | high | 7.9.3, 8.5.1 (5.x only in paid 5.11.1) |
| GHSA-9hcv-j9pv-qmph (CVE-2024-38356), GHSA-w9jx-4g6g-rp7x (CVE-2024-38357) | medium | 6.8.4, 7.2.0 (5.x only in 5.11.0) |
| GHSA-438c-3975-5x3f (CVE-2024-29203), GHSA-5359-pvf2-pw78 (CVE-2024-29881) | medium | 7.0.0 only |
| GHSA-v626-r774-j7f8 (CVE-2023-48219) | medium | 5.10.9 |
| GHSA-hgqx-r2hp-jr38, GHSA-v65r-p3vv-jjfv (CVE-2023-45819/45818) | medium | 5.10.8 |
| GHSA-gg8r-xjwq-4w92 (CVE-2022-23494) | medium | 5.10.7 (the advisory range says `<5.10.6`; an upstream inconsistency) |

The three 2026 highs were published in the TinyMCE repository on 2026-05-20; the global
GitHub Advisory Database entries were published on 2026-06-05 and state the 5.x range as
`<= 5.10.9`, patched: none (e.g. <https://github.com/advisories/GHSA-vg35-5wq7-3x7w>).
A fourth 2026 high, GHSA-mh5m-5hw4-5c69 (CVE-2026-47760), affects only 6.8.0 to <7.1.0.
Bumping to 5.10.9 (#2464) closes 4 of the 11. Tiny's support page states that
"TinyMCE 5 (both open source and commercial versions) is no longer receiving security
updates" except through a paid LTS agreement
(<https://www.tiny.cloud/docs/tinymce/latest/support/>).

## Requirements

Derived from the facts above. A candidate that cannot meet the first seven is not viable.

1. **HTML in, HTML out.** iDevice fields and HTML fields inside `jsonProperties` are
   strings; Yjs, ELPX and the exporters read strings.
2. **Arbitrary historical HTML survives** load and save: custom classes, `data-*`,
   `style`, iframes, audio, `dl`, wrappers, floats, and `data-mce-html`/`data-mce-pdf`
   markers (or a tested migration of them). eXe currently sets `valid_elements: '*[*]'`
   (`tinymce_5_settings.js:817-819`).
3. **`asset://` ↔ `blob:` rewriting**, the upload handler and the Media Library file
   picker keep working, including in dialogs.
4. **Several independent editors per iDevice**, created and destroyed by iDevice code.
5. **Save-time commit semantics**: nothing is written to Yjs while typing
   (`test/e2e/playwright/specs/collaborative/idevice-save-sync.spec.ts`).
6. **Runs with no server and no network**: static, Electron, offline and embedded in
   WordPress, Moodle and Omeka S. No license server, no CDN, no phone-home.
7. **License compatible with AGPL-3.0-or-later and redistributable offline**, and
   acceptable for a GPL WordPress.org plugin.
8. The educational plugins keep their output contract (`exe-fx`, `exe-tooltip`,
   `highlighted-code`, `abc-music`, math, Mermaid, mind maps).
9. A source-HTML view with search/replace (today: CodeMagic).
10. Delivered through the #1593 npm pipeline, not hand-copied.

## Non-requirements

- **Character-level collaborative editing.** It does not exist, was deliberately not
  activated (#2169), and is off in static mode. A native Yjs binding is a *possible
  future advantage*, not a requirement for this migration.
- Premium or cloud features of any vendor (AI, comments, track changes, cloud RTC).
- Feature parity with Word paste cleaning beyond what eXe has today.
- Changing the ELPX content model from HTML to a structured document model.
- Changing the iDevice lock model.

## Alternatives considered

The list below is the result of a screening; details and sources follow in each
subsection. Options 1 to 6 are the finalists that appear in the charts.

| # | Option | Status after screening |
|---|---|---|
| 0 | Stay on TinyMCE 5 (5.10.9 bump plus interim hardening) | Baseline, not a long-term option |
| 0b | Paid TinyMCE 5 LTS (5.11.x) | Listed; price and redistribution terms UNVERIFIED |
| 1 | **TinyMCE 8** | Finalist |
| 2 | **HugeRTE** (MIT fork of TinyMCE 6/7-pre) | Finalist |
| 3 | **CKEditor 5** with General HTML Support | Finalist, best "modern rewrite" for HTML fidelity |
| 4 | **Tiptap / ProseMirror** | Finalist, best for a structured model and Yjs |
| 5 | **Lexical** | Finalist on request; weakest fit |
| 6 | **Gutenberg block editor** | Finalist on request; rejected on evidence |
| – | Jodit, SunEditor | Screened; possible second-line HTML-first editors |
| – | Quill, Editor.js, Slate, Milkdown, Summernote, Froala, BlockNote, Trix, Pell | Screened out |
| – | Squire, Trumbowyg | **Not screened** |

### Option 0: stay on TinyMCE 5.10.9 with interim hardening

- [FACT] npm `5-latest` is 5.10.9 (2023-11-15), LGPL-2.1. It closes 4 of the 11
  advisories; the 3 high 2026 ones have no free 5.x fix.
- [EST] 2.8–7.5 person-weeks including the CodeMagic modernisation and interim hardening:
  a Content-Security-Policy for the editor iframe, DOMPurify with an explicit
  allow-list on `.elp` import, and sandboxing the preview. This was not evaluated in
  depth by any report and is proposed as a follow-up whatever the final choice.
- [OPINION] This is a **bridge**, not a destination: the security debt grows
  monotonically, and the argument "core's TinyMCE cannot run our plugins" is weaker
  for an end-of-life 5.x than for a maintained 8.x.

### Option 0b: paid TinyMCE 5 LTS

- [FACT] Tiny sells extended 5.x support (support page above); 5.11.0/5.11.1 fix the
  2024 and 2026 advisories.
- UNVERIFIED: price, and whether the LTS build may be redistributed inside an AGPL
  application and a WordPress.org plugin. **[OPINION]** Unless both are confirmed
  in writing, this is not an option for an openly redistributed product.

### Option 1: TinyMCE 8

- [FACT] `latest` 8.9.2 (2026-09-23). 17 releases between 2025-09-27 and 2026-09-27;
  23 across 8.x (bundled `CHANGELOG.md`). ~1.26 M npm downloads/week
  (<https://api.npmjs.org/downloads/point/last-week/tinymce>, secondary signal).
- [FACT] Self-hosting requires `license_key: 'gpl'`; without a key 8.x disables the
  editor (<https://www.tiny.cloud/docs/tinymce/latest/license-key/>). An "Upgrade"
  promotion appears unless `promotion: false`.
- [FACT] Free support only for "around six months after the new major version is
  available" (support page). Tracking the latest 8.x minor and moving to 9 is a
  recurring obligation. TinyMCE 9 date: UNVERIFIED.
- [FACT] The 5.x dialog and `ui.registry` model carries over:
  `windowManager.open/openUrl` are still typed in 8.9.2's `tinymce.d.ts`. What breaks:
  `DomQuery`, `editor.settings`, `getParam`, `util.XHR/Promise`, toolbar names
  (6.0, <https://www.tiny.cloud/docs/tinymce/6/migration-from-5x/>); the open-source
  `template` plugin is removed in 7.0
  (<https://www.tiny.cloud/docs/tinymce/7/migration-from-6x/>); `selection.setContent`
  deprecated, split-button DOM and stricter DOMPurify in 8.0
  (<https://www.tiny.cloud/docs/tinymce/latest/migration-from-7x/>).
- [FACT] Security-relevant defaults since 7.0: `sandbox_iframes: true`,
  `convert_unsafe_embeds: true`; DOMPurify sanitisation since 6.4
  (`xss_sanitization` to disable). [OPINION] eXe's `asset://` and `blob:` iframes are
  not host-matchable by `sandbox_iframes_exclusions`, so eXe would need
  `sandbox_iframes: false` or a narrower strategy.
- [FACT] 8.9.2 embeds DOMPurify 3.4.12 (three labels exist: `notices.txt` 3.3.2, banner
  3.4.11, code 3.4.12). That is behind DOMPurify GHSA-55q2-fjhq-7xh7 (fixed 3.4.13) and
  two low advisories of 2026-09-23 (fixed 3.4.16)
  (<https://github.com/cure53/DOMPurify/security/advisories>). Consumers cannot bump the
  bundled DOMPurify independently. This applies to TinyMCE as much as to HugeRTE.
- Precedents: Moodle `main` and 5.2 ship **8.2.2**, built from a clone of the upstream
  repository (`public/lib/editor/tiny/readme_moodle.md` and `thirdpartylibs.xml` on
  <https://github.com/moodle/moodle>), with `license_key:'gpl'`, `sandbox_iframes:false`,
  `xss_sanitization:false` ("We do this in PHP") and `promotion:false`. 8.2.2 is
  **below 8.5.1**, so Moodle main is inside the affected range of the 2026 highs, and
  "Patches included: N/A" records no backport; Moodle relies on a PHP purifier that
  eXe's static mode does not have. Moodle's `thirdpartylibs.xml` still says `MIT` for
  8.2.2, most likely stale metadata (the "why" is UNVERIFIED). Chamilo is moving from
  5.10.9 to 8.x for the same CVEs (<https://github.com/chamilo/chamilo-lms/issues/9092>).
  [OPINION] Moodle is a weaker precedent than it looks.
- Licensing: see *Licensing*.

### Option 2: HugeRTE

- [FACT] MIT fork of TinyMCE `main` at 6.8.3 plus unreleased 7.0 work, taken just before
  the GPL relicensing commit (<https://github.com/hugerte/hugerte>,
  <https://github.com/hugerte/hugerte/issues/1>). npm `hugerte` 1.0.14 (2026-09-05),
  MIT, **one npm maintainer** (`carlosmintfan`). Global renamed to `window.hugerte`; no
  `tinymce` alias. Keeps `template`; `hr` and `paste` are in core. 30 plugins.
- [FACT] Activity 2025-09-27 → 2026-09-27: 104 commits (carlosmintfan 56, dependabot 34,
  Copilot 7). A dormant period from about 2025-03 to 2026-02 (1.0.10 was
  attribution-only). OpenCollective: $85.30 raised in total
  (<https://opencollective.com/hugerte>). The maintainer wrote that he is "a single person
  which also has other projects and limited time"
  (<https://github.com/orgs/hugerte/discussions/46#discussioncomment-11977987>).
- [FACT] Security: two high advisories (2026-07-18, no own CVE IDs), inherited from
  TinyMCE's 2026 highs, fixed 23 and 40 days after TinyMCE
  (<https://github.com/hugerte/hugerte/security/advisories>). A HugeRTE-specific mXSS
  regression (`SAFE_FOR_XML` disabled) was fixed in PR #217. Every future TinyMCE fix is
  GPL code that an MIT fork has to reimplement clean-room.
- [FACT] Adobe Commerce replaced TinyMCE with HugeRTE
  (<https://experienceleague.adobe.com/en/docs/commerce-operations/release/notes/security-patches/2-4-8-patches>);
  its user docs say "2.4.6 and later", inconsistent with the patch notes that tie it to
  2.4.8-p3. Magento `2.4-develop` vendors HugeRTE **1.0.4** under `lib/web/hugerte/`,
  missing the 1.0.11–1.0.14 fixes. Adobe is not a visible contributor or sponsor.
- UNVERIFIED: the CI and AI-agent workflow characterisation (`opencode.yml` triggered by
  any `/oc` comment) until the workflow file is quoted with a commit SHA.
- [EST] Exit path: moving later from HugeRTE 1.0.x to TinyMCE 8 still needs the 8.0
  changes (`selection.setContent`, split buttons, `DomParser`, language codes), a
  `template` replacement and the license route of Option 1: **4–10 person-weeks**, not
  "mostly carries over".

### Option 3: CKEditor 5 with General HTML Support (GHS)

- [FACT] `ckeditor5` 48.5.2 (2026-09-22), LTS line 47.7.5. GPL-2.0-or-later or commercial;
  `licenseKey: 'GPL'` required since v44 and valid only for self-hosted builds
  (<https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-key-and-activation.html>).
  Under GPL the "Powered by CKEditor" badge is always shown and usage reporting is skipped
  (source of `@ckeditor/ckeditor5-ui` and `-core` 48.5.2).
- [FACT] GHS keeps markup no plugin handles but "does not offer any UI" and elements
  "still need to adhere to certain rules derived from the HTML schema"
  (<https://ckeditor.com/docs/ckeditor5/latest/features/html/general-html-support.html>).
  GHS itself had an XSS advisory, GHSA-jrqm-vmqc-gm93 (medium, 2026-03-04).
- [FACT] Accessibility: WCAG 2.2 A/AA claim and a VPAT for v44.3.0
  (<https://ckeditor.com/docs/ckeditor5/latest/features/accessibility.html>).
- Real-time collaboration needs CKEditor Cloud Services or a commercial on-premises
  server (<https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/collaboration.html>).

### Option 4: Tiptap / ProseMirror

- [FACT] `@tiptap/core` 3.31.3, MIT; paid layer is cloud features
  (<https://tiptap.dev/pricing>). ProseMirror is MIT; its GitHub repositories were
  archived on 2026-04-01 and development continues on the author's forge
  (`npm view prosemirror-model repository.url`); one lead maintainer.
- [FACT] Schema-driven: "You can't use any HTML element or attribute that is not defined
  in your schema" (<https://tiptap.dev/docs/editor/api/schema>). UI components are React.
- [FACT] Yjs: `@tiptap/extension-collaboration` (MIT) over `@tiptap/y-tiptap`;
  `y-prosemirror` npm `latest` 1.3.7, while 2.0 prereleases targeting Yjs 14 exist only
  in the repository, not as a published dist-tag.
- [FACT] Advisories 2026: GHSA-cp6q-959q-f8rh (high, `mergeAttributes()` prototype
  pollution leading to executable attributes), relevant to any "preserve all attributes"
  strategy.

### Option 5: Lexical

- [FACT] `lexical` 0.51.0 (2026-09-17), MIT, pre-1.0; nine of the last ten release notes
  mention breaking changes (<https://github.com/facebook/lexical/releases>). No published
  image node; reference UI is React. `@lexical/yjs` exists. The vanilla-JS integration
  effort is UNVERIFIED.

### Option 6: Gutenberg block editor

- [FACT] `@wordpress/block-editor` 18.0.0, GPL-2.0-or-later, peer React 18/19, 75 releases
  in 12 months. A minimal standalone editor measured at ~4.96 MB minified / 1.14 MB gzip
  JS with the wasm image pipeline externalised (Bun build, ±20 %).
- [FACT, reproduced with `@wordpress/blocks` 16.1.0 in jsdom] `parse()` of legacy eXe HTML
  returns `core/missing`; the Classic (freeform) block needs a `window.tinymce` global;
  `rawHandler` restructures images, tables and wrappers.
- [FACT] Real-time collaboration was removed from WordPress 7.0
  (<https://make.wordpress.org/core/2026/05/08/rtc-removed-from-7-0/>) and `@wordpress/sync`
  exposes no supported public API.
- [OPINION] Rejected both as a field editor and as a replacement for the iDevice model.

### Screened alternatives

- **Jodit** 4.15.14, MIT, HTML-first, zero dependencies; five advisories in 2026 (one
  high); its source mode loads Ace and js-beautify from cdnjs by default, which must be
  overridden for offline use (`esm/plugins/source/config.js`). Maintainer count
  UNVERIFIED.
- **SunEditor** 3.3.3 (2026-09-08), MIT, vanilla JS, HTML-first, repository pushed
  2026-09-22; a critical sanitiser-bypass advisory GHSA-6rf4-v2fh-m6p4 (2026-09-24,
  affects ≤2.47.10) and a high one GHSA-w93q-cq9w-58p7 (≤3.1.3). Not evaluated beyond
  this screening.
- **Squire, Trumbowyg**: not screened. Anyone arguing for them should add the evidence.
- **Discarded**: Quill 2.0.3 (no release in 12 months, unpatched GHSA-v3m3-f69x-jf25),
  Editor.js (JSON output), Slate (beta, React), Milkdown (Markdown), Summernote (jQuery,
  stagnant), Froala (proprietary), BlockNote, Trix, Pell (schema/subset models or
  abandoned).

## Comparative analysis

![Compatibility with current eXe](assets/editor-comparison/2-compatibility.svg)

*How chart 2 was computed [OPINION]:* it shows five rows of the decision matrix below
(plugin compatibility, HTML compatibility, custom dialogs, `asset://` preservation, static
mode) for each option. The scores live in
[`assets/editor-comparison/evaluation.json`](assets/editor-comparison/evaluation.json);
the chart is rendered by `node scripts/analyze-editor-debt.mjs --charts`. They are
evaluation scores, not measurements.

**HTML fidelity experiment** ([MEASURED], single run, scratch-built, **no committed
corpus**). 941 HTML fragments were extracted from the 24 `.elp`/`.elpx` files in
`test/fixtures`, parsed and serialised by each engine:

| Engine / configuration | Attributes kept | Main losses |
|---|---|---|
| Tiptap 3.31.3, stock | 71.3 % | every `div`, `section`, `figure`, `dl`, `iframe`, `audio`; `id` and `data-*` all lost |
| Tiptap with a ~40-line "preserve" layer | ~100 % | structure still normalised (`li > p`, inline images moved out, empty `<p>`); 204 of 941 fragments identical |
| Lexical 0.51.0, stock | class 0 of 6,044; `img` 0 of 917 | no image node; 1 fragment threw |
| CKEditor 5 48.5.2, stock | 44.9 % | `div`, `section`, `iframe`, `audio`, `dl`; `em` → `i` |
| CKEditor 5 with GHS allow-all | ~100 % | `em` → `i`, `b` → `strong`; 1 fragment crashed (`view-writer-cannot-break-raw-element`) |

**The same corpus was never run against TinyMCE 8 or HugeRTE.** The "pass-through"
advantage of the TinyMCE family is therefore asserted from configuration
(`valid_elements: '*[*]'`), not measured. With DOMPurify sanitisation,
`sandbox_iframes`, `convert_unsafe_embeds` and the 8.0 comment stripping enabled it may
not hold. Running this corpus on 8.9.2 and HugeRTE 1.0.14 is the first item of the
proof of concept.

**Bundle size** (see *Performance and bundle impact*).

## Migration impact

| Area | TinyMCE 8 / HugeRTE | CKEditor 5 / Tiptap / Lexical | Gutenberg |
|---|---|---|---|
| iDevices (12 init sites, ~300 `get()` calls) | Unchanged through `$exeTinyMCE`; the global becomes `hugerte` for HugeRTE | Need the facade described in *Proposed migration strategy* | Each field needs a React root |
| 4 core forks | Re-fork or rebuild on 8.x `image`/`link`/`media` | Rewrite as model plugins | Rewrite as blocks/formats |
| 20 own plugins | Port (`DomQuery`, settings, `.tox-*`) | Rewrite against a different paradigm | Rewrite in React |
| Settings and `asset://` hooks | Port the monkeypatch; re-check `data-mce-*` handling | Rebuild on converters/upload adapters | Rebuild |
| Persisted `data-mce-html/pdf` | Keep; round-trip test required (CVE-2026-47759 concerns exactly `data-mce-` attributes) | Migrate markers or map them in converters | Migrate |
| Theme CSS (`body#tinymce` in 6 themes) | Mostly keeps | Rewrite selectors | Rewrite |
| E2E (26 files pin `.tox-*`) | Partly survive (8.x still uses `.tox`) | Rewrite | Rewrite |
| i18n (`langs/all.js`) | Keep mapping, new strings | Rebuild | Rebuild |

## Plugin compatibility

**Normal public API** [FACT counts, OPINION on portability]: `ui.registry.add*` (69),
`execCommand`/`addCommand` (40), `selection.*` (119), `editor.dom.*` (292),
`undoManager` (16), `windowManager.open`. These have direct equivalents in TinyMCE 6/7/8
and HugeRTE, and conceptual equivalents elsewhere.

**Problematic coupling:** `.tox-*` (133), internal markers (111), util internals (49),
APIs removed in 6 (26), `activeEditor` (40), `parent.`/`top.` (24), the dialog monkeypatch.

**Risk ranking** (script `riskScore`, weights in the script are [EST]; tiers are
[OPINION]):

- **Rewrite, not port:** exemedia (361; 72 internal-marker hits, same mechanism as
  CVE-2026-47761), exemindmap (289; a legacy app with jQuery 1.6.1), exeimage (234; 17
  `activeEditor`, the dialog monkeypatch depends on it), exelink (166; no tests).
- **Port with UI rework:** tooltips, codemagic, abcmusic, easyattributes, exeaudio,
  exeeffects.
- **Mostly public API:** modalwindow, template, pastecode, exemermaid, blockquoteandcite,
  edicuatex, abbr, toggletoolbars, exealign, addcontent, clearfloat, definitionlist.
- **Delete rather than migrate (to confirm):** exegames_hangman, rssfeed.

For TinyMCE 8 and HugeRTE the plugin porting cost is essentially the same, because both
expose the TinyMCE 6 API shape. **[OPINION]** It is not a reason to prefer one of them.

## CodeMagic strategy

This is a **separate decision** from the main engine and can be taken first.

**What CodeMagic is [FACT]:** a `windowManager.openUrl` iframe (`codemagic.html`) that
loads host jQuery via `parent.eXeLearning.config`, CodeMirror **3.21.1**,
`batched_scripts.js` (CM3 modes, add-ons, the old `style_html` beautifier), `i18n.js` and
`codemagic.js`. Features: wrap, auto-close tags, highlighting toggle, fullscreen,
undo/redo, search/replace, "Reformat", insert. Server mode needs the
`/api/codemagic-editor/*` routes and `src/utils/editor-html.util.ts`. Its TinyMCE coupling
is small (0 `.tox-*`, 0 internals, 1 `activeEditor`); its debt is the library age, the
iframe and the routes.

**Licensing [FACT]:** the codemagic header credits Josh Lobe (ultimatetinymcepro.com) and
states no license; `grep -i license` in the plugin JS finds nothing. **[OPINION]** This is
a WordPress.org Guideline 1 blocker candidate. A clean reimplementation removes the code of
unknown license; whether the UI design itself needs attribution is UNVERIFIED.

| Option | Size (measured, min / gzip) | Effort [EST] | Assessment [OPINION] |
|---|---|---|---|
| A. Keep, upgrade to CodeMirror 5.65.21 | 279 KB / 90 KB | 1–3 days, UNVERIFIED | Stop-gap only: keeps iframe, jQuery, routes, unknown license; ships a second copy of the library WordPress ships (`wp-codemirror`, CM 5.65.20) |
| **B. CodeMirror 6 behind the same `codemagic` ID** | 544 KB / 183 KB, lazy-loadable | 1–2 person-weeks | Removes iframe, jQuery injection, routes and `parent.tinymce` coupling |
| C. CodeJar | 6 KB / 2.6 KB + highlighter | – | No search/replace or autocomplete: regression |
| D. Prism Code Editor 5.4.0 | 58 KB / 23.5 KB | 1–2 person-weeks | Credible, smaller; one maintainer, recent ownership change, accessibility claim UNVERIFIED |
| E. Ace 1.44.0 | 475 KB / 126 KB + modes | – | Heavier than B with no advantage |
| F. Engine's plain `code` dialog | 0 | < 1 day | The regression rejected in #2463; TinyMCE's advcode is premium |

Sizes: `bun build --minify`, `gzip -9`, Bun 1.4.2, ±20 %.

**Testing the hypothesis "CodeMirror 6 behind the same plugin ID" (without assuming it):**

- *Against:* B is ~8× heavier than D. *Answer:* it loads only when the dialog opens,
  as Moodle's `tiny_html` does; the claim that `html({ nestedLanguages })` can trim
  `@lezer/javascript` is **not measured**.
- *Against:* Guideline 13, WordPress ships CodeMirror. *Answer [OPINION]:* WordPress ships
  **CodeMirror 5** as `wp-codemirror`; CM6 is a different library that core does not ship,
  so B is easier to defend than A, which bundles a second copy of core's library. The
  automated Plugin Check matches `codemirror(\.min)?\.js`, i.e. CM5-style files
  (<https://github.com/WordPress/plugin-check>). How human reviewers treat CM6 is
  UNVERIFIED.
- *Against:* single-maintainer supply chain (CM5, CM6 and ProseMirror moved off GitHub in
  April 2026). *Answer:* true, and the same rubric is applied to HugeRTE below. CM6 has 47
  releases in 12 months (`@codemirror/view` 6.43.13, 2026-09-22) and Moodle core ships it
  (<https://raw.githubusercontent.com/moodle/moodle/main/public/lib/editor/tiny/plugins/html/thirdpartylibs.xml>).
- *Against:* keeping the ID is cosmetic. *Answer:* the ID only preserves toolbar and user
  habit. The value is building CodeMagic as an **engine-agnostic module** whose plugin
  file is a thin wrapper calling `getContent()`/`setContent()`; then it survives any
  engine change. D shares this property.

**Proposal [OPINION]:** B, with D as fallback if size becomes a hard constraint and A only
as a days-long stop-gap. "Reformat" (js-beautify) stays an explicit button, never
automatic, because beautifying can change whitespace-sensitive inline HTML. This can ship
before the engine decision and would have reduced #2463's regression to zero.

## Yjs considerations

- [FACT] Current model: iDevice locks plus whole-HTML save-time sync; `Y.Text` is used as
  a container with delete-all + insert; no collaboration in static mode (see *Current
  architecture*).
- [FACT] Native bindings: ProseMirror/Tiptap (`y-prosemirror`, `@tiptap/y-tiptap`) and
  Lexical (`@lexical/yjs`) have them; TinyMCE, HugeRTE and CKEditor 5 do not
  (<https://docs.yjs.dev/ecosystem/editor-bindings>). CKEditor's collaboration is
  proprietary and server-bound.
- [FACT] Gutenberg's own sync stores rich text as HTML strings in `Y.Text` and applies a
  diff (`@wordpress/core-data`, `src/utils/crdt-blocks.ts:1097-1135`), and admits the diff
  "fails in certain cases, producing corrupted output". [OPINION] So a TinyMCE-family
  editor is not excluded from future character-level sync, but string-diff sync on raw
  HTML is fragile; eXe's removed binding used the same approach.
- [OPINION] Adopting a native binding would change the stored model from HTML strings to
  `Y.XmlFragment` per field, conflict with the lock model and, for y-prosemirror 2, pull a
  Yjs 13 → 14 upgrade. That is a separate ADR. Recommended weight in this decision: low.
- Independent of the editor, and to be filed separately: no lock keep-alive during long
  iDevice edits, no notice to a client that loses a lock race, and the concatenation
  hazard of concurrent delete-all + insert (all **PLAUSIBLE, not reproduced by a test**);
  `public/app/yjs/INTEGRATION.md` still describes a NestJS/Socket.io server.

## WordPress distribution considerations

- [FACT] Guideline 13: "plugins may not include those libraries in their own code.
  Instead plugins must use the versions of those libraries packaged with WordPress"
  (<https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/>).
  WordPress core ships TinyMCE **4.9.11** (`$tinymce_version = '49110-20250317'` in trunk
  `wp-includes/version.php`, <https://github.com/WordPress/wordpress-develop>), CodeMirror
  5.65.20 as `wp-codemirror`, and React 18.3.1 plus the `wp-*` packages.
- [FACT] The automated Plugin Check flags `jquery*.js`, `jquery-ui*.js` and
  `codemirror(.min)?.js`, but not TinyMCE (`File_Type_Check::look_for_library_core_files`,
  <https://github.com/WordPress/plugin-check>). eXe's build contains
  `plugins/codemagic/includes/codemirror/codemirror.js` and
  `exemindmap/editor/js/jquery.min.js`, which match.
- [OPINION] Arguments available to wp-exelearning:
  - Core's TinyMCE 4.9 cannot run eXe's plugins (they need the 5+ `ui.registry` API) and
    the editor runs in its own iframe document outside `wp_enqueue_script`.
  - A maintained 8.x or a different library (HugeRTE, CKEditor 5) is easier to defend
    than an end-of-life 5.x with public high CVEs.
  - HugeRTE uses a different global, so it cannot clash with core's `tinymce` on admin
    pages. Gutenberg would be the worst case: it duplicates exactly what core ships.
  - No reviewer statement supports any of this; it is argument, not evidence.
- [OPINION] **A trust-model issue bigger than the editor.** eXe deliberately allows
  arbitrary HTML and JavaScript (`*[*]`; the fixture corpus contains 19 `onclick` and
  scripts). In wp-exelearning a WordPress user **without `unfiltered_html`** (Author,
  Contributor) can upload an `.elp` whose extracted HTML then runs on the site. No editor
  choice fixes that; it needs a policy in wp-exelearning (capability check or sanitising
  on extraction). It should be tracked in that repository.
- [FACT] Licensing inside eXe's own plugins: most eXe-own plugins declare **CC BY-SA 4.0**
  in their headers, exemindmap declares MIT, codemagic declares none. [OPINION] CC BY-SA
  4.0 is one-way compatible with GPLv3 only; whether WordPress.org accepts it under
  Guideline 1 is UNVERIFIED. This applies to every option.

## Licensing

- eXeLearning is **AGPL-3.0-or-later** (`LICENSE`, `package.json`). `public/libs/README.md`
  lists `tinymce_5/*` as LGPL-2.1; `THIRD-PARTY-NOTICES.md` does not list TinyMCE [FACT].
- [FACT] GPL-2.0-or-later code can be used under GPLv3, and "You can always link
  GPLv3-covered modules with AGPLv3-covered modules"
  (<https://www.gnu.org/licenses/gpl-faq.html#AllCompatibility>). [OPINION, not legal
  advice] TinyMCE 7/8, CKEditor 5 and Gutenberg (GPL-2.0-or-later) and MIT editors are
  therefore compatible with eXe.

| Option | License | Key / branding | Offline, no cloud |
|---|---|---|---|
| TinyMCE 5.10.x | LGPL-2.1 | none | yes |
| TinyMCE 8 | GPL-2.0-or-later; npm 8.3+ `license.md` adds Tiny's terms (below) | `license_key:'gpl'`, `promotion:false` | yes by code reading; runtime network capture **UNVERIFIED** |
| HugeRTE | MIT (+ bundled DOMPurify MPL-2.0/Apache-2.0) | none | yes |
| CKEditor 5 | GPL-2.0-or-later or commercial | `licenseKey:'GPL'`, permanent badge | yes for self-hosted |
| Tiptap / ProseMirror / Lexical | MIT | none (cloud features paid) | yes |
| Gutenberg | GPL-2.0-or-later | none | yes |

**The TinyMCE 8 npm license text [FACT].** Up to 8.2.2 the npm `license.md` is plain GPL.
From **8.3.0 (2025-12-10)** it reads "Licensed under, and subject to the restrictions of:
1. The terms of GNU General Public License Version 2 or later; or 2. The Tiny
Technologies, Inc Software Terms & Conditions … **By use of this Software you have agreed
to these Tiny Technologies, Inc Software Terms & Conditions of Use.**" The repository's
`LICENSE.md` is still plain GPL. The Gruntfile copies the repository `LICENSE.md` into
source builds and applies `license-npm.md` only to the npm component zip ("TINY-13411: The
component zip which is used for NPM needs to have dual license";
`modules/tinymce/Gruntfile.js` lines 333-334 and 690-692 on
<https://github.com/tinymce/tinymce>).

**These two routes conflict, and the team must pick one [OPINION]:**

1. *Consume npm through #1593.* Simple and consistent with #1593, but ships the "By use …
   you have agreed" sentence. It may be read as an additional restriction on the GPL grant
   (removable under GPLv3 §7, but ambiguous for WordPress.org and distribution
   packagers). Needs a written legal or FSF-style opinion first.
2. *Build from the tagged GitHub source* inside the #1593 pipeline (a build step rather
   than a plain copy), as Moodle does. Pure GPL text, more build complexity.

Whether Tiny intends the sentence to restrict GPL users is UNVERIFIED. Choosing HugeRTE
or an MIT editor avoids the question.

## Security

- [FACT] Status quo: 11 advisories, 3 high without a free 5.x fix (see *Current technical
  debt*).
- [OPINION] **Exploitability depends on eXe's trust model.** Authors can already inject
  JavaScript by design, so sanitiser-bypass CVEs matter mainly on cross-trust paths:
  importing an untrusted `.elp`, server-mode collaboration between co-authors, and
  wp-exelearning uploads by users without `unfiltered_html`. This lowers the urgency of a
  *fast* major upgrade and raises the value of the cheap interim mitigations in Option 0.
  It does not make staying on 5.x acceptable indefinitely.
- [OPINION] **Sanitisation policy must be decided with the engine.** Turning on
  TinyMCE 7/8 (or HugeRTE) DOMPurify would strip legitimate legacy content (`onclick`,
  inline scripts in HTML iDevices). Turning it off, as Moodle does, gives back much of the
  CVE benefit, and eXe's static mode has no server-side purifier to compensate. The
  decisions `xss_sanitization`, `sandbox_iframes` (for `asset://`/`blob:` iframes) and
  `convert_unsafe_embeds` (legacy `<object>`/`<embed>`) belong in the same ADR as the
  engine.
- [FACT] Bundled sanitisers lag: TinyMCE 8.9.2 ships DOMPurify 3.4.12, HugeRTE 1.0.14 ships
  3.4.14, both behind DOMPurify's 2026-09-23 fixes. Neither can be patched by the consumer.
- [FACT] Other bundled legacy code with known advisories: jQuery 1.6.1 in the mind-map
  editor (CVE-2011-4969, CVE-2012-6708, CVE-2015-9251, CVE-2020-11023; via
  <https://github.com/advisories?query=jquery>), CodeMirror 3.21.1 (whether CVE-2020-7760's
  affected mode is bundled is UNVERIFIED).
- [OPINION] A uniform sustainability rubric is applied to every dependency in the matrix
  (publishers, funding, time to fix the 2026 highs, cost to fork if abandoned). Measured
  time-to-fix for the 2026 TinyMCE highs: TinyMCE 0 days (source), HugeRTE 23–40 days,
  Moodle main not yet (8.2.2). Tiny's commercial direction (license changed in 7.0 and
  again in the 8.3 npm text; features moved to premium) is scored under *License* and
  *Lock-in*, not ignored.

## Accessibility

- [FACT] CKEditor 5: WCAG 2.2 A/AA claim and VPAT (link above). Lexical: keyboard
  accessibility contract, mobile screen readers "not exercised"
  (`packages/lexical-website/docs/concepts/keyboard-accessibility.md`). Tiptap: a guide
  only (<https://tiptap.dev/docs/guides/accessibility>); toolbars are the integrator's job.
  CodeMirror 6: "works well with screen readers and keyboard-only users"
  (<https://codemirror.net/>).
- UNVERIFIED: a current conformance statement for TinyMCE 8 and HugeRTE, independent
  audits of Gutenberg and Prism Code Editor. The matrix scores for these are **[OPINION]**.
- [OPINION] eXe's own dialogs (exeimage, exemedia, tooltips, …) matter more for authors
  than the engine's claims; any migration should include keyboard and screen-reader checks
  of the eXe dialogs, not only of the toolbar.

## Performance and bundle impact

| Engine | Core JS (min / gzip) | Source | Kind |
|---|---|---|---|
| TinyMCE 5.10.2 (today) | 392 KB / 134 KB; whole `tinymce_5` directory 2.9 MB | repo | [FACT] |
| TinyMCE 5.10.9 | 393 KB / 135 KB | npm tarball | [FACT] |
| TinyMCE 8.9.2 | 487 KB / 170 KB; all min assets 3.12 MB | npm tarball | [FACT] |
| HugeRTE 1.0.14 | 482 KB / 169 KB; all min assets ~2.57 MB | npm tarball | [FACT] |
| Lexical (core + rich-text, html, table, list, link, history) | 291 KB / 93 KB | esbuild | [MEASURED] |
| Tiptap (StarterKit + TableKit + Image) | 439 KB / 139 KB, no UI | esbuild | [MEASURED] |
| CKEditor 5 Classic + GHS + tables, media, source | 1,139 KB / 311 KB + ~216 KB CSS | esbuild | [MEASURED] |
| Gutenberg minimal field | ~4.96 MB / 1.14 MB (+ ~69 KB gzip CSS) | Bun build | [MEASURED] |

- [EST] TinyMCE 8 adds ~25–30 % of core payload over 5.x; dropping `paste`, `hr`, `lists`
  and `template` folders offsets part of it. eXe's plugins (~1.7 MB in `plugins/`) are
  unaffected by the engine size.
- Runtime memory with many editors per iDevice was **not measured** for any engine.
- The tables' "measured" values are single builds; treat ±20 %.

## Migration cost

![Estimated migration effort by option](assets/editor-comparison/1-migration-effort.svg)

*How chart 1 was computed [EST]:* the bar is the midpoint and the whisker the min–max of
the sum of the ten categories in the table below, taken from
[`evaluation.json`](assets/editor-comparison/evaluation.json) and rendered by
`node scripts/analyze-editor-debt.mjs --charts`. **Engineering estimate, not an
implementation measurement.**

Person-weeks, min–max. **Every cell is an engineering estimate, not an implementation
measurement.** The basis is the measured surface: 24 plugins / 15,908 lines, 4 forks, 12
iDevice init sites, ~300 `get()` calls, 17 Vitest and 26 Playwright files, the
`asset://` hooks and the persisted markers. No earlier effort figure from the research
("several person-weeks", "multi-quarter", "several person-months") is comparable with
these or with each other.

| Category | Stay 5.10.9 | TinyMCE 8 | HugeRTE | CKEditor 5 | Tiptap | Lexical | Gutenberg |
|---|---|---|---|---|---|---|---|
| Proof of concept | 0 | 1–2 | 1–2 | 2–4 | 2–4 | 2–4 | 3–6 |
| Core migration | 1–3 | 3–6 | 3–5 | 6–10 | 8–14 | 10–18 | 12–24 |
| Own plugins | 0 | 8–16 | 7–14 | 16–30 | 18–34 | 20–38 | 24–45 |
| CodeMagic | 1–2 | 1–2 | 1–2 | 1.5–3 | 1.5–3 | 1.5–3 | 1.5–3 |
| asset:// pipeline | 0 | 2–4 | 2–4 | 3–6 | 3–6 | 3–6 | 4–8 |
| Unit tests | 0.5–1 | 2–4 | 2–4 | 4–8 | 4–8 | 4–8 | 5–10 |
| E2E tests | 0–0.5 | 1–3 | 1–3 | 3–6 | 3–6 | 3–6 | 4–8 |
| Legacy compatibility | 0–0.5 | 2–4 | 2–4 | 4–8 | 6–12 | 8–14 | 8–16 |
| Documentation | 0.25–0.5 | 0.5–1 | 0.5–1 | 1–2 | 1–2 | 1–2 | 1–2 |
| Cleanup | 0 | 0.5–1 | 0.5–1 | 1–2 | 1–2 | 1–2 | 1–3 |
| **Total** | **2.8–7.5** | **21–43** | **20–40** | **41.5–79** | **47.5–91** | **53.5–101** | **63.5–125** |
| Confidence | medium | medium-low | medium-low | low | low | low | very low |

Notes on the estimates:

- *Stay* core migration includes the interim hardening (CSP, import sanitisation).
- *HugeRTE* is slightly cheaper than TinyMCE 8 because `template` survives and no license
  route has to be settled, but its later exit to TinyMCE 8 is estimated separately at
  **4–10 person-weeks** (see Option 2).
- *CodeMagic* is identical across TinyMCE-family options if built engine-agnostic; for
  other engines the dialog host must be rebuilt.
- *Legacy compatibility* includes building the round-trip corpus gate in CI; for schema
  editors it also includes the "preserve" layer.
- *E2E* is smaller for the TinyMCE family because 8.x still renders `.tox-*`; whether the
  specific selectors survive is UNVERIFIED.

## SWOT analysis

Only eXe-specific points.

### TinyMCE 8

| Strengths | Weaknesses |
|---|---|
| Same HTML-first model and `windowManager`/`ui.registry` API family as today; most plugins port rather than rewrite | Recurring major-upgrade obligation (~6 months of free fixes after each new major) |
| Most active upstream of the TinyMCE family; security fixes land first | `template` removed; Word paste cleaning removed from open source |
| Offline with `license_key:'gpl'`; no framework dependency | Bundled DOMPurify lags upstream; `sandbox_iframes`/sanitisation defaults conflict with `asset://` iframes and legacy HTML |

| Opportunities | Threats |
|---|---|
| Clean up `.tox-*`, `DomQuery`, forks while porting; move plugins out of `public/libs` | npm 8.3+ license sentence; conflict with #1593's plain npm route |
| Same engine as Moodle and (soon) Chamilo; shared knowledge | Further features moving to premium; license changed twice already |
| A maintained engine strengthens the wp-exelearning case | Persisted `data-mce-*` markers vs CVE-2026-47759 behaviour are untested |

### HugeRTE

| Strengths | Weaknesses |
|---|---|
| MIT, no key, no promotion, keeps `template` | Bus factor 1, $85 in funding, a dormant year already happened |
| TinyMCE 6 API shape: same porting cost as TinyMCE 8 | Every upstream fix must be reimplemented clean-room; 23–40 days behind on the 2026 highs |
| Different global: no clash with WordPress core's `tinymce` | Docs and language packs depend on Tiny's v6 assets; no minor release in two years |

| Opportunities | Threats |
|---|---|
| eXe could contribute upstream and share maintenance with Adobe's users | Abandonment; flagship user vendors a stale 1.0.4 |
| Avoids the TinyMCE 8 license question for downstream integrators | Exit to TinyMCE 8 costs another 4–10 person-weeks [EST] |

### CKEditor 5 (best modern rewrite for eXe's HTML)

| Strengths | Weaknesses |
|---|---|
| Real UI included; strongest accessibility statement (VPAT) | Largest bundle (~311 KB gzip JS + CSS) |
| GHS keeps ~100 % of attributes in the single-run experiment | Every eXe plugin rewritten on the model/view/converter architecture |
| Active vendor with an LTS line | Permanent "Powered by" badge under GPL; `licenseKey` plumbing |

| Opportunities | Threats |
|---|---|
| Modern model, source editing (Classic editor) | GHS is where a 2026 XSS advisory landed; `em` → `i` and a crash on 1 of 941 fragments |
| Clearer separation of eXe features as widgets | Upsell pressure (RTC, enhanced source are commercial) |

### Tiptap / ProseMirror (best modern rewrite for a structured model and Yjs)

| Strengths | Weaknesses |
|---|---|
| MIT, headless, vanilla-usable; native Yjs binding | Schema drops unknown markup: 71 % of attributes stock, structure normalised even with a preserve layer |
| Stable v3 API | No UI or source view; React UI components |

| Opportunities | Threats |
|---|---|
| Character-level collaboration if ever wanted | ProseMirror has one lead maintainer; y-prosemirror 2 moves to Yjs 14 |
| Structured content for future features | A preserve-all-attributes layer reopens the XSS surface (GHSA-cp6q-959q-f8rh) |

## Risk matrix

Probability and impact are **[OPINION]** (Low / Medium / High).

| Risk | Probability | Impact | Option | Mitigation |
|---|---|---|---|---|
| Historical HTML silently rewritten or lost on load/save | High | High | Tiptap, Lexical, Gutenberg | Corpus round-trip gate in CI; opaque HTML island node; do not choose without passing the gate |
| Historical HTML altered by sanitisation/sandbox defaults | Medium | High | TinyMCE 8, HugeRTE, CKEditor 5 | Run the 941-fragment corpus on 8.9.2/HugeRTE first; decide `xss_sanitization`, `sandbox_iframes`, `convert_unsafe_embeds` explicitly |
| Persisted `data-mce-html/pdf` markers stripped or rewritten | Medium | High | All except Stay | Round-trip test on the target; migrate markers to eXe-owned `data-exe-*` with a load-time mapper |
| Broken eXe plugins after migration | High | High | All except Stay | Migrate by risk tier; tests first for exelink and tooltips; feature flag |
| Feature loss (template, Word paste, source view, mind maps) | Medium | Medium | TinyMCE 8 (template), schema editors (source view) | Rebuild `template` as an eXe plugin; CodeMagic B; accept documented losses explicitly |
| Unpatched vulnerabilities while migrating | High | Medium | Stay, and any option during the transition | Interim CSP and import sanitisation; bump to 5.10.9 now |
| Upstream abandonment | Medium | High | HugeRTE (high), Lexical 0.x churn (medium) | Keep an exit plan and a thin boundary; contribute upstream |
| Single-maintainer dependency | High | Medium | HugeRTE, ProseMirror/Tiptap, CodeMirror 6, Prism Code Editor | Same rubric for all; pin versions; watch advisories; budget a fork |
| Vendor license or feature drift | Medium | Medium | TinyMCE 8, CKEditor 5 | Decide the license route; avoid premium-dependent features |
| WordPress.org rejection of bundled libraries or plugin licenses | Medium | High | All (TinyMCE via human review; CodeMirror 3 and jQuery via automated check; CC BY-SA and unlicensed plugin code) | CodeMagic B; remove jQuery 1.6.1 from exemindmap; clarify plugin licenses; argue the self-contained editor |
| wp-exelearning users without `unfiltered_html` running uploaded scripts | Medium | High | Independent of editor | Capability check or sanitising extraction in wp-exelearning |
| Bundle growth | High | Low | CKEditor 5, Gutenberg (high); TinyMCE 8 (low) | Lazy-load plugins and CodeMagic; measure in CI |
| Offline/static breakage (CDN defaults, license servers, absolute paths) | Medium | High | Jodit, CKEditor 5 cloud build, TinyMCE without `gpl` key | Self-hosted builds only; static-mode E2E |
| `asset://` regressions (blob mapping, dialog patch, upload handler) | High | High | All except Stay | Port `_patchAssetDialogs` to a public hook; dedicated tests |
| Dialog, iframe and media regressions (`openUrl` apps, `sandbox_iframes`, media placeholder) | High | Medium | All except Stay | Keep `openUrl` apps behind a small dialog adapter; exemedia rewrite with tests |
| Future migrations become as costly as this one | High | High | All | Move plugins out of the vendor tree; narrow boundary; no new `.tox-*` or internal markers |

## Decision criteria

Unweighted scores, 1 = worst for eXe, 5 = best. **Every score is technical opinion**,
anchored in the facts cited above; the source of truth is
[`evaluation.json`](assets/editor-comparison/evaluation.json). "Stay 5.10.9" is a
reference point: it scores well on compatibility because it *is* the current state, and it
fails the security requirement in the long term.

| # | Criterion | Stay 5.10.9 | TinyMCE 8 | HugeRTE | CKEditor 5 | Tiptap | Lexical | Gutenberg |
|---|---|---|---|---|---|---|---|---|
| 1 | HTML compatibility | 5 | 4 | 4 | 3 | 2 | 1 | 1 |
| 2 | Plugin compatibility | 5 | 3 | 3 | 1 | 1 | 1 | 1 |
| 3 | Migration cost | 5 | 3 | 3 | 2 | 1 | 1 | 1 |
| 4 | Own maintenance effort | 2 | 4 | 3 | 3 | 2 | 1 | 2 |
| 5 | Project stability | 3 | 4 | 3 | 4 | 4 | 1 | 2 |
| 6 | Security | 1 | 4 | 3 | 3 | 3 | 3 | 3 |
| 7 | Update frequency | 1 | 5 | 3 | 5 | 5 | 5 | 5 |
| 8 | Community | 1 | 5 | 2 | 4 | 4 | 4 | 5 |
| 9 | Bus factor | 1 | 4 | 1 | 4 | 3 | 4 | 5 |
| 10 | License | 5 | 3 | 5 | 3 | 5 | 5 | 4 |
| 11 | AGPL compatibility | 5 | 4 | 5 | 5 | 5 | 5 | 5 |
| 12 | Offline redistribution | 5 | 4 | 5 | 4 | 5 | 5 | 4 |
| 13 | No cloud dependency | 5 | 4 | 5 | 4 | 5 | 5 | 5 |
| 14 | Bundle size | 4 | 3 | 3 | 1 | 4 | 5 | 1 |
| 15 | Runtime size | 3 | 3 | 3 | 2 | 4 | 4 | 1 |
| 16 | Lazy loading | 3 | 3 | 3 | 3 | 4 | 4 | 2 |
| 17 | Performance | 3 | 3 | 3 | 3 | 4 | 4 | 2 |
| 18 | Accessibility | 2 | 4 | 3 | 5 | 2 | 3 | 4 |
| 19 | Mobile | 2 | 4 | 3 | 4 | 3 | 3 | 3 |
| 20 | Tables | 4 | 4 | 4 | 4 | 3 | 2 | 3 |
| 21 | Media | 4 | 3 | 3 | 3 | 2 | 1 | 3 |
| 22 | Custom dialogs | 5 | 4 | 4 | 3 | 2 | 2 | 3 |
| 23 | Custom plugins | 5 | 4 | 4 | 3 | 3 | 2 | 2 |
| 24 | Source HTML | 4 | 4 | 4 | 3 | 1 | 1 | 2 |
| 25 | Extensibility | 3 | 4 | 4 | 4 | 5 | 4 | 4 |
| 26 | Yjs integration | 2 | 2 | 2 | 1 | 5 | 4 | 2 |
| 27 | Static mode | 5 | 5 | 5 | 4 | 4 | 4 | 2 |
| 28 | Electron | 5 | 5 | 5 | 5 | 5 | 5 | 4 |
| 29 | Server | 5 | 5 | 5 | 5 | 5 | 5 | 4 |
| 30 | WordPress (wp-exelearning) | 3 | 4 | 4 | 3 | 4 | 4 | 1 |
| 31 | Guideline 13 risk | 2 | 3 | 4 | 4 | 5 | 5 | 1 |
| 32 | asset:// preservation | 5 | 4 | 4 | 2 | 2 | 2 | 2 |
| 33 | Educational plugin preservation | 5 | 3 | 3 | 2 | 2 | 1 | 1 |
| 34 | Framework dependency | 5 | 5 | 5 | 5 | 4 | 4 | 1 |
| 35 | Lock-in | 3 | 3 | 4 | 3 | 3 | 3 | 1 |
| 36 | Abandonment risk | 1 | 4 | 2 | 4 | 4 | 3 | 5 |
| 37 | Ease of replacing the engine later | 3 | 3 | 3 | 2 | 2 | 2 | 1 |
| | **Unweighted total (of 185)** | **130** | **140** | **132** | **123** | **127** | **118** | **98** |

Scoring notes: for "cost", "risk", "effort", "lock-in" and "dependency" criteria a higher
score means *less* cost or risk. "Runtime size", "lazy loading", "performance" and
"mobile" were not measured for any engine and carry the least evidence.

![Migration effort vs long-term architectural risk](assets/editor-comparison/3-effort-vs-risk.svg)

*How chart 3 was computed [OPINION + EST]:* X is the midpoint of the effort total above
(whisker = min–max). Y is the mean of `5 − score` over eight matrix rows that describe
long-term architectural change or risk: HTML compatibility, plugin compatibility,
`asset://` preservation, educational plugin preservation, framework dependency, bus
factor, abandonment risk and lock-in (0 = no change/risk, 4 = maximal). The list is in
`evaluation.json` (`architecturalRisk`); the script computes the values.

## Suggested weighting for discussion

Weights are 0 (ignored) to 3 (critical). **These weights are debatable, are offered only
to structure the discussion, and must not decide automatically.** The weighted result is
the weighted sum divided by the maximum reachable with the same weights, as a percentage.

| Criterion | Suggested (balanced) | Max compatibility | Max security | Max innovation | Min maintenance | Max WordPress |
|---|---|---|---|---|---|---|
| HTML compatibility | 3 | 3 | 1 | 1 | 1 | 1 |
| Plugin compatibility | 2 | 3 | 1 | 0 | 3 | 1 |
| Migration cost | 2 | 3 | 1 | 0 | 3 | 1 |
| Own maintenance effort | 2 | 1 | 1 | 1 | 3 | 1 |
| Project stability | 2 | 1 | 3 | 1 | 3 | 1 |
| Security | 3 | 1 | 3 | 1 | 1 | 2 |
| Update frequency | 1 | 1 | 3 | 2 | 1 | 1 |
| Community | 1 | 1 | 2 | 2 | 1 | 1 |
| Bus factor | 2 | 1 | 3 | 1 | 2 | 1 |
| License | 2 | 1 | 1 | 1 | 1 | 3 |
| AGPL compatibility | 3 | 1 | 1 | 1 | 1 | 3 |
| Offline redistribution | 3 | 1 | 1 | 1 | 1 | 3 |
| No cloud dependency | 3 | 1 | 2 | 1 | 1 | 3 |
| Bundle size | 1 | 1 | 1 | 2 | 1 | 2 |
| Runtime size | 1 | 1 | 1 | 2 | 1 | 1 |
| Lazy loading | 1 | 1 | 1 | 3 | 1 | 1 |
| Performance | 1 | 1 | 1 | 3 | 1 | 1 |
| Accessibility | 2 | 1 | 1 | 2 | 1 | 1 |
| Mobile | 1 | 1 | 1 | 3 | 1 | 1 |
| Tables | 1 | 1 | 1 | 1 | 1 | 1 |
| Media | 2 | 1 | 1 | 1 | 1 | 1 |
| Custom dialogs | 1 | 3 | 1 | 1 | 1 | 1 |
| Custom plugins | 2 | 1 | 1 | 1 | 1 | 1 |
| Source HTML | 2 | 3 | 1 | 1 | 1 | 1 |
| Extensibility | 1 | 1 | 1 | 3 | 1 | 1 |
| Yjs integration | 1 | 0 | 0 | 3 | 1 | 1 |
| Static mode | 3 | 3 | 1 | 1 | 1 | 3 |
| Electron | 2 | 3 | 1 | 1 | 1 | 1 |
| Server | 2 | 3 | 1 | 1 | 1 | 1 |
| WordPress (wp-exelearning) | 2 | 1 | 1 | 1 | 1 | 3 |
| Guideline 13 risk | 2 | 1 | 1 | 1 | 1 | 3 |
| asset:// preservation | 3 | 3 | 1 | 1 | 1 | 1 |
| Educational plugin preservation | 3 | 3 | 1 | 1 | 1 | 1 |
| Framework dependency | 2 | 1 | 1 | 1 | 1 | 2 |
| Lock-in | 1 | 1 | 1 | 1 | 1 | 1 |
| Abandonment risk | 2 | 1 | 3 | 1 | 3 | 1 |
| Ease of replacing the engine later | 1 | 1 | 1 | 2 | 2 | 1 |

**Weighted result, suggested profile:** TinyMCE 8 77.1 · Stay 5.10.9 75.1 · HugeRTE 74.5 ·
CKEditor 5 67.8 · Tiptap 67.8 · Lexical 62.6 · Gutenberg 53.9.

## How changing the weights changes the result

| Weight profile | Stay 5.10.9 | TinyMCE 8 | HugeRTE | CKEditor 5 | Tiptap | Lexical | Gutenberg | Leader (margin) |
|---|---|---|---|---|---|---|---|---|
| Suggested (balanced) | 75.1 | 77.1 | 74.5 | 67.8 | 67.8 | 62.6 | 53.9 | TinyMCE 8 (+2.0 over Stay) |
| Maximum compatibility | 80.7 | 77.9 | 75.0 | 65.0 | 61.4 | 57.1 | 49.3 | Stay 5.10.9 (+2.8 over TinyMCE 8) |
| Maximum security | 61.7 | 78.8 | 67.1 | 70.8 | 70.4 | 64.6 | 60.8 | TinyMCE 8 (+8.0 over CKEditor 5) |
| Maximum innovation | 62.7 | 74.1 | 67.8 | 66.3 | 73.7 | 69.4 | 54.5 | TinyMCE 8 (+0.4 over Tiptap) |
| Minimum own maintenance | 67.8 | 74.7 | 66.9 | 64.1 | 63.7 | 56.3 | 51.4 | TinyMCE 8 (+6.9 over Stay) |
| Maximum WordPress distribution | 74.1 | 76.3 | 77.4 | 68.9 | 75.6 | 72.6 | 54.4 | HugeRTE (+1.1 over TinyMCE 8) |

What the sensitivity analysis shows [OPINION]:

- **The top of the ranking is fragile.** In four of six profiles the leader wins by less
  than 3 points out of 100, well inside the uncertainty of opinion scores. The matrix does
  not "pick" an engine; it narrows the discussion.
- **Maximum compatibility favours staying**, which is expected (the baseline *is* current
  compatibility) and is exactly why a hard security requirement, not a weight, has to
  exclude Stay in the long term.
- **Maximum security** separates TinyMCE 8 most clearly; HugeRTE drops because of bus
  factor, lag and abandonment risk.
- **Maximum innovation** makes Tiptap nearly tie TinyMCE 8, only because plugin
  compatibility and migration cost weigh 0. Any weight on HTML fidelity puts Tiptap back
  behind.
- **Maximum WordPress distribution** puts HugeRTE first: MIT, a different global, no npm
  license sentence. The margin (1.1) is small.
- **Gutenberg is last in every profile**, and Lexical is never above fifth.
- A reviewer who changes a single score can flip the TinyMCE 8 / HugeRTE / Stay order;
  anyone disagreeing should propose the score change in the PR with its evidence.

To recompute after changing `evaluation.json`: `node scripts/analyze-editor-debt.mjs
--out tmp/editor-debt` (tables in `editor-debt.md`) and `--charts` for the SVGs.

## Open questions

1. Which license route for TinyMCE 8: npm 8.3+ text with a legal opinion, or a
   source build inside #1593? Or does this question alone favour HugeRTE?
2. `xss_sanitization`, `sandbox_iframes` and `convert_unsafe_embeds` policy, decided
   together with the trust model (untrusted `.elp` import, server collaboration,
   wp-exelearning without `unfiltered_html`).
3. Does the 941-fragment corpus survive TinyMCE 8.9.2 and HugeRTE 1.0.14 with the proposed
   configuration? Do persisted `data-mce-html/pdf` markers survive 8.x?
4. Which current features are non-negotiable (template, Word paste, mind maps, hangman,
   RSS feed)? Can `exegames_hangman` and `rssfeed` be deleted?
5. Does the GPL self-hosted TinyMCE 8 build make any network request at runtime? Needs a
   DevTools or Playwright network capture before it is used in a WordPress.org Guideline 7
   argument (currently only a code reading).
6. Is the paid TinyMCE 5 LTS redistributable, and at what price?
7. Are CC BY-SA 4.0 plugin headers acceptable for WordPress.org, and who can relicense
   them? What is codemagic's license?
8. Does `window.parent.eXeLearning.symfony.fullURL` or `top.$exeAuthoring.fileUpload`
   (used by exemindmap) still exist at runtime? UNVERIFIED.
9. Should the collaboration model (locks plus save-time sync) get its own ADR before any
   Yjs-driven editor argument is weighed?

## Proposed migration strategy

### Big-bang vs incremental

| | Big-bang | Incremental |
|---|---|---|
| Shape | One branch replaces TinyMCE 5 and all plugins | Steps below, each shippable |
| Dual maintenance | None, but a long-lived branch rots against `main` | Bounded: two engines only behind a flag, with a removal date |
| Risk | All regressions surface at once | Regressions surface per plugin tier |
| Fit for eXe | [OPINION] Poor: 24 plugins, ~20 % tested, three deployment targets | [OPINION] Better, if the dual phase is time-boxed |

**Proposed incremental sequence [OPINION]:**

1. **Now, engine-independent:** bump to 5.10.9 (the TinyMCE half of #2464) and add the
   interim hardening; land CodeMagic B; delete unreachable plugins once confirmed.
2. **Extract eXe plugins out of the vendor tree** (structure below) without changing
   behaviour; update `exe_abc_music.js`, `ResourceFetcher.js` and the pruning test.
3. **Add compatibility tests first:** commit the corpus round-trip gate; add tests for
   `exelink` and `tooltips`; add `asset://` and dialog tests.
4. **Introduce the target engine through #1593**, behind a feature flag, with both engines
   selectable in development and CI only.
5. **Migrate plugins by risk tier**, lowest first, so the tooling matures before
   exemedia/exeimage/exelink.
6. **Remove TinyMCE 5** and the flag at a date fixed when step 4 starts. **No indefinite
   dual maintenance.**

### Future structure

Proposed, adapted to this repository's conventions (colocated Vitest tests, vendored
libraries generated by #1593):

```text
public/app/editor/
  engine/            # loader and configuration for the chosen engine
                     # (the engine itself comes from the #1593 pipeline, not from git)
  exe-editor.js      # the eXe boundary, see below (today: $exeTinyMCE in tinymce_5_settings.js)
  plugins/
    exeimage/        # moved from public/libs/tinymce_5/js/tinymce/plugins/exeimage
      plugin.js
      exeimage.test.js
    …
  codemagic/         # engine-agnostic source editor (CodeMirror 6), thin plugin wrapper
test/fixtures/editor-roundtrip/   # the HTML corpus and expected outputs
```

### Does an adapter layer add value? [OPINION]

- **Yes, at the boundary between eXe and the editor**, which is small and already exists as
  `$exeTinyMCE`: create/destroy editors, `get(id).getContent/setContent/save`,
  `editors[]`, the `asset://` hooks, the upload handler, the dialog host and the Yjs
  save hook. Pointing iDevices at that object instead of the `tinyMCE` global covers ~95 %
  of their ~300 calls and makes the next engine change cheaper.
- **No, inside plugins.** Emulating the TinyMCE API over another engine would be a large,
  leaky abstraction that nobody upstream maintains. Plugins should use the chosen engine's
  native API directly.
- **If a TinyMCE-family engine is chosen, the adapter barely changes**: the plugin API is
  already the engine's API, so a generic adapter would be unnecessary abstraction. Keep
  only the boundary object and forbid new `.tox-*`, `data-mce-*` and `tinymce.util.*`
  uses in eXe code (a lint rule is enough).
- **If a schema editor is chosen**, the boundary is necessary but not sufficient; the
  cost is in the plugins and the content model, as the estimates show.

## Decision

**No decision has been made yet.**

This record stays `Proposed` while the team discusses it in
[PR #2467](https://github.com/exelearning/exelearning/pull/2467). It moves to `Accepted`
only when enough consensus is documented there, with the chosen option, the answers to
the open questions that block it (at least the license route and the sanitisation
policy), and the names of the deciders in the frontmatter.

## Consequences

### Positive

- The team decides with one shared set of counts, estimates and sources.
- The metrics script makes the debt measurable and re-runnable after each step.
- CodeMagic and the interim hardening can proceed now; they do not depend on the engine.

### Negative

- Until a decision is made, TinyMCE 5.10.2 keeps its 11 advisories (4 closable at once
  with 5.10.9).
- Scores and estimates are opinion; they may give false precision if read as a ranking.

### Neutral

- #2464 (TinyMCE part) and #2463 stay closed; their outcome follows from this record.
- Whatever is chosen should be consumed through #1593.

## Risks

See *Risk matrix*. The largest risk of *this record* is anchoring: the suggested weights
favour the TinyMCE family by small margins that a single score change can reverse.

## Validation

- `node scripts/analyze-editor-debt.mjs` reproduces every repository count quoted here;
  `bun test scripts/analyze-editor-debt.spec.ts` checks determinism and that the charts in
  `assets/editor-comparison/` match the script and `evaluation.json`.
- Before acceptance: run the HTML corpus on the preferred engine(s); capture the network
  activity of a GPL self-hosted TinyMCE 8 build; round-trip `data-mce-html/pdf`.
- After implementation: the round-trip gate runs in CI and the script shows zero
  `.tox-*`, internal markers and removed APIs in eXe plugins.

## Follow-up work

- Bump TinyMCE to 5.10.9 and add interim hardening (independent of the choice).
- CodeMagic on CodeMirror 6 behind the same ID (reopens the substance of #2463).
- Commit the HTML round-trip corpus and its gate.
- wp-exelearning: policy for `.elp` uploads by users without `unfiltered_html`.
- Clarify licenses of eXe plugins (CC BY-SA 4.0 headers, codemagic).
- Separate issues: Yjs lock keep-alive and lost-lock notice; stale `INTEGRATION.md`.

## References

- Repository at `f64d72fb5`: `public/libs/tinymce_5/`, `public/app/editor/tinymce_5_settings.js`,
  `public/app/yjs/`, `public/app/core/Capabilities.js`, `src/index.ts`,
  `src/shared/export/constants.ts`, `test/e2e/playwright/`.
- [`scripts/analyze-editor-debt.mjs`](../../../scripts/analyze-editor-debt.mjs) and
  [`assets/editor-comparison/evaluation.json`](assets/editor-comparison/evaluation.json).
- PRs and issues: #1593, #2463, #2464, #2267, #2169, #2467 on
  <https://github.com/exelearning/exelearning>.
- TinyMCE: <https://www.npmjs.com/package/tinymce>, <https://github.com/tinymce/tinymce>,
  <https://github.com/tinymce/tinymce/security/advisories>,
  <https://www.tiny.cloud/docs/tinymce/latest/support/>,
  <https://www.tiny.cloud/docs/tinymce/latest/license-key/>,
  <https://www.tiny.cloud/docs/tinymce/6/migration-from-5x/>,
  <https://www.tiny.cloud/docs/tinymce/7/migration-from-6x/>,
  <https://www.tiny.cloud/docs/tinymce/latest/migration-from-7x/>.
- HugeRTE: <https://github.com/hugerte/hugerte>, <https://www.npmjs.com/package/hugerte>,
  <https://opencollective.com/hugerte>, <https://github.com/hugerte/hugerte/security/advisories>.
- Adobe Commerce: <https://experienceleague.adobe.com/en/docs/commerce-operations/release/notes/security-patches/2-4-8-patches>,
  <https://experienceleague.adobe.com/en/docs/commerce-admin/content-design/wysiwyg/editor>,
  <https://github.com/magento/magento2/tree/2.4-develop/lib/web/hugerte>.
- Moodle: <https://github.com/moodle/moodle> (`public/lib/editor/tiny/`).
- CKEditor 5: <https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-and-legal.html>,
  <https://github.com/ckeditor/ckeditor5/security/advisories>.
- Tiptap / ProseMirror / Lexical: <https://tiptap.dev/docs/editor/api/schema>,
  <https://prosemirror.net/docs/guide/>, <https://lexical.dev/docs/getting-started/quick-start>,
  <https://github.com/yjs/y-prosemirror>, <https://docs.yjs.dev/ecosystem/editor-bindings>.
- Gutenberg / WordPress: <https://developer.wordpress.org/block-editor/how-to-guides/platform/custom-block-editor/>,
  <https://make.wordpress.org/core/2026/05/08/rtc-removed-from-7-0/>,
  <https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/>,
  <https://github.com/WordPress/plugin-check>.
- DOMPurify: <https://github.com/cure53/DOMPurify/security/advisories>.
- CodeMirror: <https://codemirror.net/>, <https://code.haverbeke.berlin/codemirror/dev>.
- GNU license compatibility: <https://www.gnu.org/licenses/gpl-faq.html#AllCompatibility>.
