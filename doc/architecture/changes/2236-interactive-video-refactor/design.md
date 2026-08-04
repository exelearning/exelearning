---
tracking_issue: 2236
title: "Interactive Video iDevice refactor"
status: in-review
date: 2026-07-09
legacy_id: SDD-0001
authors:
  - "@erseco"
reviewers:
  - "@mnunezcedec"
  - "@cristinavaldera"
implementation_prs: [2147]
related_adrs: [ADR-2236-01, ADR-2236-02, ADR-2236-03, ADR-2236-04, ADR-2236-05]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# Interactive Video iDevice refactor — design

## Amendment — TypeScript sources, two generated bundles, schema v2 (2026-07)

The maintained source of this iDevice is **TypeScript** under
`public/files/perm/idevices/base/interactive-video/src/`:

```text
src/
├── globals.d.ts        # ambient types for the eXe classic-script globals
├── shared/             # pure core: types, schema, migration, time, video-source,
│                       #   captions, cloze, scheduling, scoring, playback, html
├── providers/          # SDK-free provider adapters (HTML5, YouTube, Vimeo,
│                       #   Mediateca) behind one ProviderAdapter contract
├── edition/            # inline editor ($exeDevice): device, editor, form,
│                       #   player/timeline, body-editor, interactions/ per kind
├── export/             # learner runtime ($interactivevideo): runtime, renderer,
│                       #   interaction-queue, scoring, scorm
└── test/               # cross-cutting helpers, fixtures, bundle-contract tests
```

`scripts/build-idevices.ts` — the centralized build for every iDevice that
keeps TypeScript under `src/` (currently `slide` and this one) — compiles, by
convention (`src/edition|export/index.ts` → `edition|export/<name>.js`; a
`build.config.json` manifest covers deviations), two self-contained
classic-script bundles that
`config.xml` loads — `edition/interactive-video.js` (exposes
`window.$exeDevice`) and `export/interactive-video.js` (exposes
`window.$interactivevideo`). The shared core and the provider adapters are
compiled INTO both bundles; the old byte-identical per-folder copies (and their
drift-check) are gone. **Generated bundles and their source maps are
gitignored** — a clean checkout regenerates them via `make bundle` (or
`bun run bundle:idevices`), which every test target already runs.

Developer workflow:

- Type-check: `bun run typecheck:idevices` (strict per-iDevice tsconfig,
  `noUncheckedIndexedAccess`).
- Build: `bun run bundle:idevices` (add `--only interactive-video` to filter);
  watch mode: `bun run bundle:idevices:watch`.
- Unit tests: colocated `*.spec.ts` next to each module —
  `bun x vitest run public/files/perm/idevices/base/interactive-video/src`.
- Debugging: the bundles ship `.js.map` source maps, so browser stack traces
  map back to the TypeScript sources.
- `src/test/bundle-contract.spec.ts` evaluates the ACTUAL compiled bundles and
  asserts the classic-script contracts, catching bundling regressions that
  source-level imports cannot.

**Schema v2 is the only published versioned schema.** The unpublished
intermediates that appeared during review (v1, v3) were consolidated into v2,
and the chain migrations between them were removed. `hydrateDocument(unknown)`
in `src/shared/schema.ts` is the single entry point: original legacy content
(HTML island / `htmlView` / `textTextarea` / parsed `slides` object) migrates
DIRECTLY to v2 via `migrateLegacyToV2`; stored v2 documents are normalized
field by field (`normalizeV2`, idempotent, never a cast); `schemaVersion > 2`
returns `unsupported-version` with the original payload preserved — the editor
then refuses to save and the runtime leaves the stored markup untouched.

Where the review narrative below mentions `interactive-video-core.js`,
`interactive-video-providers.js`, mirrored copies, or v1/v3 migration steps, it
describes the pre-TypeScript layout this amendment supersedes; the behaviour it
records is unchanged.

## Summary

The native eXeLearning **Interactive Video** iDevice was a pre-3.0
"quext"-style component: a detached full-screen editor (a chrome-less
`ISO-8859-1` iframe with a ~2200-line `admin.js`) plus a ~3200-line self-booting
learner runtime that loaded external provider SDKs and polled a cross-origin
player. This SDD records its rebuild into a **modern, integrated, accessible,
framework-free** iDevice: an **inline tabbed editor** rendered inside the iDevice
body, a **declarative, script-free learner runtime**, a **versioned JSON data
model** stored in `jsonProperties` (`component-type=json`), and a **bounded,
idempotent, lossless on-open migration** from all legacy shapes. Import, export,
preview and SCORM compatibility are preserved, and no frontend framework is
introduced.

The change is large and cross-cutting (authoring UX, runtime, storage format,
export registration, migration, security, accessibility), which is why it is
captured as an SDD with the durable decisions extracted into ADRs
(ADR-2236-01…ADR-2236-05).

## Problem statement

The legacy `interactive-video` iDevice had two disjoint surfaces:

1. A **detached full-screen editor** — `edition/editor/index.html`
   (charset `ISO-8859-1`, `%TOKEN%` i18n) plus a ~2200-line `admin.js`, launched
   in a chrome-less Bootstrap `.modal-fullscreen` iframe with its own Save/Quit
   lifecycle (a confusing "save the editor, then save the iDevice" two-step),
   reaching across frames via top-window globals and loading jwplayer from an
   external CDN on every edit.
2. A **self-booting learner runtime** (`export/interactive-video.js`, ~3200
   lines) that re-parsed a JSON island from the DOM, loaded
   `youtube.com/iframe_api` and jwplayer as external `<script>`s, drove a nested
   cross-origin `YT.Player` synchronously, and polled `getCurrentTime()` on a
   500 ms `setInterval`.

Consequences: it was inaccessible (keyboard traps, icon-only links whose
accessible name was blanked on focus, no `aria-live`, no captions, fixed-pixel
layout), fragile (triplicated helpers, `eval`-based script loading, top-window
singletons that forbade more than one instance per page), a security liability
under the project's emerging opaque-origin serving model (external scripts +
synchronous cross-origin control cannot survive a sandbox without
`allow-same-origin`), and untestable (the detached editor had zero tests).

## Goals

- **G1** — Replace the detached full-screen editor with an **integrated, inline**
  authoring UI rendered inside the iDevice editing area; no detached windows, no
  full-screen editor popup, no application-covering overlays.
- **G2** — A simple, predictable, **accessible (WCAG 2.2 AA-oriented)** author
  flow across named native tabs.
- **G3** — A **deterministic, declarative, framework-free learner runtime** for
  timed interactions; keyboard-operable; degrades gracefully.
- **G4** — A **versioned, normalized data model** with stable interaction ids and
  a structured video descriptor; **idempotent migration** from every existing
  shape; unknown/legacy data preserved losslessly.
- **G5** — Preserve **import/export/preview/SCORM** compatibility; existing `.elp`
  and exported HTML5/SCORM/EPUB3/IMS content keeps working.
- **G6** — Extract fragile logic into **tested pure functions** (URL
  normalization, time parse/format, sorting, grading/completion, migration,
  schema); TDD.
- **G7** — Define a **`VideoProviderAdapter` boundary** so the runtime is
  compatible with the future opaque-origin sandbox without hard-depending on the
  (not-yet-merged) bridge.
- **G8** — Remove `eval`, unescaped author-content `innerHTML`, external-script
  loading in exported content, `alert()/confirm()`, hardcoded Spanish, and
  top-window singletons.

## Non-goals

- Not an H5P wrapper; no dependency on the H5P runtime/editor (H5P is UX
  inspiration only).
- No React/Vue/Svelte/Angular or any frontend framework; no Popcorn.js.
- Not implementing the full opaque-origin sandbox / parent relay — that is
  PR #1968 / host-plugin scope and is absent from this branch; we only prepare a
  clean adapter boundary.
- No answer-conditional branching / adaptivity graphs / chapter menus.
- Not migrating storage to xAPI/LRS; SCORM 1.2/2004 stays.
- Not removing any interaction type: all 8 legacy kinds remain first-class.

## Current state

Before this change (all paths repo-root-relative):

- `public/files/perm/idevices/base/interactive-video/config.xml` — legacy
  declaration with no `component-type`, so the parser defaulted to `html`.
- `edition/editor/index.html` + `edition/editor/js/admin.js` — the detached
  editor.
- `export/interactive-video.js` — the self-booting runtime.
- Data was a single JSON object serialized into the text of
  `#exe-interactive-video-contents` inside `htmlView`
  (`doc/elpx-format/idevices/patterns.md`, "Pattern 3"), with the video URL
  living **outside** the JSON in a sibling
  `<p id="exe-interactive-video-file"><a href>`. `slides[]` held 8 interaction
  types keyed by array index, with integer-second `startTime`/`endTime`.
- Pre-v3 `.elp` import: `src/shared/import/legacy-handlers/InteractiveVideoHandler.ts`.

## Proposed design

The design (amended in review, before the corresponding implementation lands):

- **Integrated inline editor** (ADR-2236-01) — `edition/interactive-video.js`
  renders the whole authoring UI inline in the iDevice body using the native
  `.exe-form-tab` → `$exeDevicesEdition.iDevice.tabs.init()` pattern, with
  element-scoped state (no `top.*` singletons). The detached
  editor/full-screen flow is no longer the authoring path.
- **Versioned JSON storage** (ADR-2236-02) — the iDevice is `component-type=json`;
  `save()` returns a plain object stored in `jsonProperties`, and export renders
  via `renderView(jsonProperties, template)`. A bounded on-open migration
  hydrates the versioned schema from the legacy `htmlView` island; already-
  generated exports are untouched.
- **Declarative script-free runtime** (ADR-2236-03) — a fresh
  `export/interactive-video.js` (`$interactivevideo`) renders declarative,
  escaped HTML from the JSON and wires the player, scheduler, grading, scoring
  and SCORM at runtime. No author JavaScript is evaluated; no provider SDK
  `<script>` is emitted into exports.
- **Provider normalization behind an adapter boundary** (ADR-2236-04) — external
  providers are stored as `{provider, videoId}` and rebuilt to canonical
  privacy-enhanced URLs; a shared adapter layer (`src/providers/`, compiled into both bundles) owns
  playback control and time events for every provider today via SDK-free
  postMessage, and the future opaque bridge remains the opaque-mode path.
- **Framework-free** (ADR-2236-05) — no UI framework and no H5P runtime; the
  maintained source is TypeScript compiled into two self-contained classic-
  script bundles (see the TypeScript amendment above).

## User experience

The editor is a native tabbed form inside the iDevice body (verified in
`edition/interactive-video.js`). Above the tabs it renders the standard iDevice
description banner
(`$exeDevicesEdition.iDevice.common.getIdeviceDescription(...)`), consistent with
sibling iDevices. In the workarea's default (non-advanced) mode only the **first**
`.exe-form-tab` is visible, so everything essential must live in the first tab;
the tab set is:

- **General settings** — the first and primary tab, in this order:
  1. **Options** — a **collapsed** fieldset
     (`<fieldset class="exe-fieldset exe-fieldset-closed">`) holding the
     behaviour-and-scoring fields (completion mode, required score, show results,
     score non-interactive), the progress-report settings
     (`gamification.progressBar`), the optional **poster image** (image picker)
     and the **subtitle tracks** (design 1a: "scoring, progress report and cover
     image"). Collapsed by default because these are secondary to authoring the
     video and its interactions.
  2. **Video** — an **open** fieldset with a **source-mode combo** (URL / Local
     file, design 1a) whose right-hand field switches accordingly: URL mode
     shows a URL input whose **provider is auto-detected**
     (`normalizeVideoSource`: YouTube / Vimeo / Mediateca; any other safe URL is
     direct media, i.e. `local`); Local file mode shows the media-library file
     picker (the workarea injects a single "Select a file" button) plus a
     supported-formats hint. There is no per-provider radio group. In the
     editor preview, Mediateca and direct media URLs mount a native `<video>`
     (Mediateca over its legacy stream URL via
     `providers.mediatecaStreamUrl`), matching the learner runtime.
  3. **Interactions** — an **open** fieldset (its legend shows a live
     interaction count) containing the inline player with the proportional
     timeline joined underneath, the add bar and the single-editor accordion
     (below).

  There are **no Content before / Content after boxes**: content around the
  video belongs to ordinary sibling **Text iDevices in the same block**. The
  importer (`src/shared/import/interactiveVideoContentSplit.ts`) converts the
  retired `contentBefore`/`contentAfter` fields of pre-release documents into
  such siblings on `.elp`/`.elpx` import — and on single `.idevice`/`.block`
  import (`ComponentImporter` resolves the same shared function through
  `window.SharedImporters`) — only when they carry real content, and strips
  them from the stored jsonProperties either way.
- **Custom texts** — the full set of learner-runtime strings the author may
  override, rendered by the shared `getLanguageTab` helper.
- **SCORM** — the shared SCORM options tab.

All fieldsets use the standard `exe-fieldset` class (not a bespoke
`exe-iv-fieldset`) so the central collapse wiring in `common_edition.js` applies.

The standalone **Preview** tab is **removed**. No sibling iDevice ships an
in-editor preview tab, and in default mode it would sit on a hidden second tab
where authors would rarely reach it; the full learner experience is the workarea
**Preview** (eye), which now delivers the timed experience for every provider
(see *Preview/runtime parity*). Removing it also deletes the associated
`renderPreview` code and its CSS.

**Interactions authoring (single-editor accordion).** Inside the Interactions
fieldset, a single column stacks: the inline player → a **proportional
timeline** joined under it (design variant *1a*) → the add bar (Note / Question
/ Pause / Jump plus a **"Use current time"** control) → **one** interaction
list (`ol#ivInteractionList`) that behaves as an accordion.

The timeline is a track showing the playback **progress fill** and **playhead
knob** (driven by the adapter's event-push `onTimeUpdate`; the scale comes from
`getDuration()`, falling back to spreading the existing markers when the
duration is not yet known) with one **positioned, colour-coded marker** per
interaction (`ol#ivEditTimeline`, one `<button data-iv-id>` per interaction at
`left: time/duration %`; clicking a marker selects its row and seeks the player
via the adapter when available). Kinds are colour-coded consistently across the
markers, the row type badges, the selected-row accent and a **colour legend**
under the track (note = brand teal, question = orange, pause = purple, jump =
blue). **Clicking the track** places the clicked time into the add bar and
seeks the player; when no duration is known yet the click announces politely
instead of guessing (manual time entry always works). The timeline box is shown
only when a playable surface (video/iframe) rendered.

Each list row shows the time (tabular-nums), a type badge, a summary,
a validity hint and an edit/duplicate/delete button group. The **selected** row
expands and hosts the **single** editor **inside** its `<li>` (a sibling
container of the row button, never nested inside a button); no interaction is
ever rendered twice. There is no detached `#ivDetailPanel` and no
`exe-iv-editor-layout` grid — the earlier dual-list layout is gone.

Focus management is an explicit contract: adding focuses the first editor field;
deleting focuses the next row (else previous, else the add button); duplicating
focuses the copy's editor; focus is preserved across re-renders by data-id and
field id. Editing a title updates the row summary text node in place (no full
re-render); changing the time re-sorts and moves the row and its marker. The list
is keyboard-operable — roving tabindex across rows, Arrow/Home/End navigation,
Enter/Space to expand, Esc to collapse back to the row button, `aria-expanded` on
the row button, and a stable `aria-live` polite region for editor
announcements. An empty-state hint renders at first paint. Placement is never
drag-only.

**Use current time** works for **all** providers. Both the add-bar control and a
per-interaction "Set to current time" next to the time field call
`adapter.getCurrentTime()` through the provider adapter (see *Provider adapter
contract*); for external providers this reads the live playhead via the
provider's embed messaging rather than being a local-only feature. When no
adapter is available or the provider is in a degraded state, the control surfaces
a clear message instead of silently doing nothing.

Fields carry inline **help hints** (the standard `exe-form-help` info icon,
wired for the inline form).

## Technical design

Cited files live under
`public/files/perm/idevices/base/interactive-video/`; paths and evidence are
re-verified at the final review commit of PR #2147.

### Shared pure core

`src/shared/` holds all DOM-free logic as typed modules: time parse/format
(`time.ts`), provider detection and URL safety (`video-source.ts`), schema +
migration (`schema.ts`: `SCHEMA_VERSION`, `hydrateDocument`, `normalizeV2`,
`serializeDocument`; `migration.ts`: `migrateLegacyToV2`, `readLegacyIsland`),
captions (`captions.ts`), cloze/dropdown segments (`cloze.ts`, `html.ts`),
scheduling (`scheduling.ts`), grading/completion (`scoring.ts`) and played
segments (`playback.ts`). Both bundles compile it in, so the editor and the
runtime can never drift; each bundle also publishes the legacy-shaped
`window.exeInteractiveVideoCore` namespace (`core-api.ts`) for tests and
external probes.

**Packaging note:** `config.xml` resolves `edition-js`/`export-js`
`<filename>` entries against the `edition/`/`export/` subfolders; each lists
only its generated `interactive-video.js` bundle.

### Editor architecture

`src/edition/` (compiled to `edition/interactive-video.js`; `$exeDevice`)
builds the inline tab form, hydrates from previous data (v2 doc, legacy island,
or empty; a NEWER `schemaVersion` puts the editor into a read-only unsupported
state that refuses to save), renders and binds each tab, and `save()` returns
the plain v2 object → `jsonProperties`. Editor logic is thin DOM over the pure core; each interaction
kind has a first-class authoring UI with a **dedicated control per kind** (review
items 3, 4, 5):

- **singleChoice** — the correct-answer control is an **exclusive** radio group
  (`name="ivAnswerCorrect-{interaction.id}"`); selecting one correct answer zeroes
  the others so exactly one is correct. `multipleChoice` keeps checkboxes.
- **trueFalse** — a **dedicated** boolean control: a labelled True/False radio
  pair (`_('True')` / `_('False')`) writing `question.solution` (`0|1`), default
  `1` (True). It does **not** reuse the multiple-choice answer rows and has no
  "+ Answer" repeater.
- **cloze / dropdown** — the prompt is authored in a **plain-text** textarea using
  `[[…]]` blank tokens (`[[blanco|blanca]]` for answer variants). "Mark selection
  as blank" wraps the selection in `[[…]]` (idempotent unmark when already inside
  a token). Blank count comes from parsing the plain text. The canonical stored
  form is **semantic segments** (see Data model), derived on input/save; the
  textarea round-trips via `segmentsToPromptText`. **No `<span>` line-through
  markup is ever written to the textarea or persisted, and none is ever shown to
  the author.**
- `matchElements` keeps a pairs editor and `sortableList` an ordered-items editor
  (unchanged).

`save()` validates before returning (via `eXe.app.alert` + `return false`):
singleChoice needs ≥2 non-empty answers and exactly one correct; trueFalse needs
a prompt; cloze/dropdown need ≥1 blank. Media pickers use the workarea's
`.exe-file-picker` / `.exe-image-picker` auto-wiring.

### Learner runtime architecture

`export/interactive-video.js` (`$interactivevideo`) exposes `renderView(data,
accessibility, template, ideviceId)` (declarative HTML) and
`renderBehaviour(data, accessibility, ideviceId)` (player + scheduler + grading).
Scheduling is **event-driven**, not a `setInterval` poll: one shared scheduler
consumes the provider adapter's `onTimeUpdate` events — native `timeupdate` for
local video, the provider's embed message events for external embeds — so the
same scheduling code drives the editor canvas, workarea Preview and exports for
every provider. Rendering escapes all author content; author overrides of runtime
strings are honoured via a keyed translate helper reading the saved custom texts.

### Data model

`save()` produces (schema in `interactive-video-core.js`):

```jsonc
{
  "schemaVersion": 2,
  "video": {
    "provider": "local | youtube | vimeo | mediateca",
    "url": "…", "videoId": "…|null", "posterAssetId": "…|null",
    "captions": [ { "src": "…", "lang": "es", "label": "…", "default": true } ]
  },
  "interactions": [
    {
      "id": "iv-<stable-unique>",
      "type": "note | question | pause | jump | unsupported",
      "time": 12.5, "duration": 5, "pause": true,
      "title": "…", "body": "…",
      "asset": { "assetId": "…", "alt": "…" },
      "question": {
        "kind": "singleChoice | multipleChoice | trueFalse | dropdown | cloze | matchElements | sortableList",
        "prompt": "…",                              // choice kinds
        "answers": [ ["text", 0] ],                 // choice kinds (singleChoice: exactly one correct)
        "solution": 1,                              // trueFalse only: 0 (False) | 1 (True), default 1
        "segments": [                               // cloze/dropdown only: canonical blank model
          { "t": "text", "text": "el caballo " },
          { "t": "blank", "answers": ["blanco", "blanca"] }
        ],
        "additionalWords": [ "…" ],                 // dropdown only: distractor options
        "pairs": [ ["a","b"] ], "items": [ "…" ]    // matchElements / sortableList
      },
      "jump": { "toTime": 90 },
      "originalType": "…", "raw": { }
    }
  ],
  "completion": { "mode": "none | watch | answerRequired | scoreThreshold | manual", "requiredScore": 80 },
  "scorm": { "enabled": false, "weight": 100 },
  "customTexts": { /* author overrides of runtime labels, keyed by ci18n key */ },
  "meta": { "legacy": { } }
}
```

Times are numbers (seconds); every interaction has a stable id; unknown/future
types are preserved verbatim as `unsupported`. `schemaVersion` is **2** (review
items 3–5): `trueFalse` questions carry a `solution` field (`0|1`) instead of an
answers array, and `cloze`/`dropdown` questions carry a `segments` array
(`{t:'text'|'blank', …}`) as the canonical, HTML-free blank model. Blank prompt
text is stored as segments only — **no editor HTML markup (line-through spans) is
ever persisted**.

`migrateDoc` gains a **forward-only, idempotent, never-throw** v1→v2 step
(v2 documents pass through untouched):

- **singleChoice normalization** — if more than one answer is marked correct,
  keep the **first** correct (stable order) and zero the rest (first-correct
  wins); if none is correct, leave as-is (editor validation forces resolution and
  grading yields 0).
- **trueFalse conversion** — collapse the legacy answers array to
  `{kind:'trueFalse', prompt, solution, score, retry}`: `solution = 1` when the
  first correct answer text matches `/^(true|verdadero|v|t|1)$/i` **or** the
  correct index is 0, else `0`; the redundant answers array is dropped.
- **cloze/dropdown segments derivation** — parse the legacy HTML prompt
  (line-through blanks, including `<s>`/`<strike>`/`<del>` per the shared
  `collectDropdownBlankNodes`) into `segments` (`'|'` splits answer variants;
  dropdown keeps `additionalWords`). Double-escaped `&lt;span…` prompts are
  unescaped once and re-parsed; a prompt with no detectable blank becomes a single
  text segment (lossless).

The migration remains a single pure pass; idempotency (`migrate(migrate(x))
deep-equals migrate(x)`) is a contract test.

### Interaction model

All **8 interaction/question kinds are first-class** (ADR-2236-01/ADR-2236-03):
`note` (text/image), `pause`, `jump`, and `question.kind` ∈ {`singleChoice`,
`multipleChoice`, `trueFalse`, `dropdown`, `cloze`, `matchElements`,
`sortableList`}. Each is authored with its own dedicated control (see *Editor
architecture*): `singleChoice` uses an exclusive radio correct-answer control,
`trueFalse` a dedicated boolean control, and `cloze`/`dropdown` a plain-text
`[[…]]` blank editor whose canonical storage is the HTML-free `segments` model.
Each is rendered accessibly by the runtime and graded by the shared core.
`matchElements` renders a per-left `<select>`; `sortableList` uses keyboard
Move-up/Move-down buttons (no drag-only).

Line-through `<span>` blanks appear **only** as a legacy input: the v1→v2
migration and a read-only runtime fallback parse them into `segments` (via the
DOM-based `collectDropdownBlankNodes`, never a regex), but no such markup is ever
written by the editor or shown to the author. New content stores and displays
`segments` exclusively; the runtime renders cloze inputs and dropdown `<select>`s
from segments with text **escaped on output** (no raw author HTML at the prompt
or blank sites).

### Video provider handling and external video

External providers are stored as `{provider, videoId}` and rebuilt to canonical
privacy-enhanced URLs (`youtube-nocookie.com/embed/{id}`,
`player.vimeo.com/video/{id}`); unsafe schemes (`javascript:`) and non-HTTPS are
rejected by `isSafeVideoUrl`. Embeddable providers render an **inline iframe**
(with `referrerpolicy="strict-origin-when-cross-origin"`), not a new-window link.
Provider-specific behavior is isolated behind the adapter boundary so the runtime
gets playback control and time events for every provider today (review items 2
and 7), while the parent-mediated opaque bridge (PR #1968) remains the
**opaque-mode** path selected by feature detection.

#### Provider adapter contract

A new classic script, `interactive-video-providers.js` (global
`window.exeInteractiveVideoProviders`, kept in the same root/`edition/`/`export/`
three-copy mirror as the core and covered by the same drift-check), exposes a
`createAdapter({provider, url, videoId, video, iframe})` factory. Every adapter
implements one interface:

```
{ load():Promise, play(), pause(), seekTo(s), getCurrentTime():Promise<number>,
  getDuration():Promise<number|null>, onReady(cb), onTimeUpdate(cb(seconds)),
  onStateChange(cb('playing'|'paused'|'ended')), destroy() }
```

The transports are **SDK-free** — no provider `<script>` is ever loaded, so
ADR-2236-03's no-external-script guarantee holds for exports:

- **Local HTML5** — wraps the `<video>` element: native `timeupdate` →
  `onTimeUpdate`; `play`/`pause`/`ended` → `onStateChange`; `currentTime`/
  `duration` read directly.
- **YouTube** — raw postMessage on the `youtube-nocookie.com/embed` iframe with
  `enablejsapi=1`, using the same wire protocol the official IFrame API uses
  (`{"event":"listening"}` handshake, `infoDelivery` time pushes, `command`
  messages). `&origin=` is appended only when `location.origin` is an `http(s)`
  origin and **omitted** for opaque/`file:` contexts (where the origin is
  `"null"`).
- **Vimeo** — the documented `player.vimeo.com` postMessage protocol
  (`addEventListener` for `ready`/`play`/`pause`/`finish`/`timeupdate`; `play`/
  `pause`/`setCurrentTime`/`getDuration` methods).
- **Mediateca** — a native `<video>` over the derived legacy stream URL
  `https://mediateca.educa.madrid.org/streaming.php?id={videoId}` (the legacy
  runtime fed exactly this URL to jwplayer as an mp4 source —
  `main:export/interactive-video.js:829-836`; host verified alive 2026-07-10). On
  media error it **degrades** to a keyboard-accessible link plus manual time
  entry.

All time signals are **event-push** (YouTube `infoDelivery`, Vimeo `timeupdate`,
HTML5 `timeupdate`) — there is no polling anywhere. Message handling is strictly
validated: only `event.source === iframe.contentWindow` **and**
`event.origin === expected origin`, JSON parsed in `try/catch`, and shape-checked
before use. There is exactly one `message` listener per adapter instance, removed
in `destroy()`, with no module-global mutable player state, so multiple instances
on one page are isolated (dispatch by `event.source`). `load()` resolves on
provider ready and **rejects after a bounded timeout** (default 7000 ms,
injectable for tests) or on media error, so callers degrade gracefully (keep the
timeline, external link and manual time entry; never block rendering).

Provider capabilities, and where each degrades:

| Capability | Local HTML5 | YouTube | Vimeo | Mediateca |
|---|---|---|---|---|
| Current time | Supported (`video.currentTime`) | Supported (`infoDelivery`) | Supported (`timeupdate`) | Supported when stream loads; else Degrades-to-manual |
| Pause | Supported (`video.pause()`) | Supported (`pauseVideo` command) | Supported (`pause` method) | Supported when stream loads |
| Resume / play | Supported (`video.play()`) | Supported (`playVideo` command) | Supported (`play` method) | Supported when stream loads |
| Duration | Supported (`video.duration`) | Best-effort (`onReady`/`infoDelivery`) | Best-effort (`getDuration` reply) | Supported when stream loads |
| Seek | Supported (`currentTime=`) | Supported (`seekTo` command) | Supported (`setCurrentTime`) | Supported when stream loads |
| Time events | Supported (`timeupdate`) | Best-effort (~4 pushes/s while playing) | Best-effort (`timeupdate` cadence) | Supported (native `timeupdate`) |

"Best-effort" reflects provider event granularity and autoplay/gesture policies,
not exact-time determinism; "Degrades-to-manual" keeps the accessible timeline
list, the external link and manual time entry as the fallback. Mediateca has no
canonical iframe embed URL and remains not opaque-promotable (ADR-2236-04).

### Preview and export registration (runtime parity)

Review item 7's root cause is a **registration gap**, not a runtime-logic gap.
`src/shared/export/browser/idevice-config-browser.ts` lists each JSON iDevice's
extra `<export-js>` dependencies in `IDEVICE_JS_DEPENDENCIES`, and the
interactive-video entry was missing — so `interactive-video-core.js` was never
loaded in the workarea **Preview** or in **browser exports**, and
`renderBehaviour` silently aborted when the core global was absent. The video
never paused and questions never appeared even for local video, exactly the
review finding. The fix has three parts:

- Add `'interactive-video': ['interactive-video-core.js',
  'interactive-video-providers.js']` to `IDEVICE_JS_DEPENDENCIES` (dependencies
  load **before** the main file).
- Add a **filesystem contract test** asserting that every `component-type=json`
  iDevice with extra non-main `.js` files in `export/` has a matching
  `IDEVICE_JS_DEPENDENCIES` entry, so a future iDevice cannot regress the same
  way.
- Replace the silent `renderBehaviour` retry-exhaustion return with a loud
  `console.error('[interactive-video] shared core failed to load — behaviour
  disabled')` so a missing dependency is visible rather than silent.

*Superseded by the TypeScript amendment:* the runtime is now ONE self-contained
bundle, so there are no extra `<export-js>` dependencies to register (the
`IDEVICE_JS_DEPENDENCIES` entry was removed again) and the core-load retry path
no longer exists — the whole failure class is structurally impossible. The
filesystem contract test remains for other iDevices.

A second defect fixed here is **multi-instance id collision**: the runtime now
resolves its instance id from the injected `data.ideviceId`
(`id = ideviceId || (data && data.ideviceId) || doc.ideviceId || doc.id ||
this.baseId`), so two interactive-video activities on one page no longer share
scheduler/DOM state. One shared, event-driven scheduler (fed by the provider
adapter's time events) now drives the editor canvas, the workarea Preview and the
exports identically for every provider.

### SCORM / progress / score behavior

Gradable, SCORM 1.2 via the shared `gamification.scorm` path; deterministic pure
grading/completion in the core (`aggregateScore`, `computeCompletion`).
Completion is tracked per explicit setting (`watch | answerRequired |
scoreThreshold | manual`). Grading never crosses the media adapter boundary.

## Amendment — watched progress, completion and score reporting

### What the learner actually watched

The runtime keeps the set of ranges the learner has genuinely played, as
disjoint `[from, to]` segments, and derives progress from their union rather
than from the `ended` event. The calculations are pure and live in the shared
core (`addPlayedRange`, `mergeSegments`, `uniqueWatchedTime`, `watchedProgress`,
`furthestPosition`, `isVideoCompleted`), so the editor, the preview and the
export share one implementation and it is unit-testable without a DOM.

Merge rules: ranges are sorted and merged when they overlap or sit within
`SEGMENT_MERGE_EPSILON` (0.5 s) of each other — `timeupdate` fires about every
250 ms, so bridging that gap keeps continuous playback as one segment instead of
hundreds. Invalid input (non-finite, negative, reversed, zero-length) is ignored
and ranges are clamped to a known duration. Adding a range is O(n log n) on the
segment count, which stays small because playback merges into few segments.

`uniqueWatchedTime` counts overlaps once; `totalWatchTime` counts every second
played, re-watching included. Both are kept: the first answers "how much of the
video has been seen", the second "how long was spent watching".

The runtime folds a range in on every time signal, but **only when the step is
small** (`MAX_PLAYED_STEP`, 2 s). A larger step is a seek or an authored jump,
and the skipped span is deliberately not counted. That is the point of the whole
mechanism: dragging the scrub bar to the end must not read as having watched.

The first time signal has nothing to measure against, so the span before it is
not claimed. At a normal `timeupdate` interval that is a quarter of a second —
noise against the completion threshold.

### Three separate ideas, previously one

| | Meaning |
|---|---|
| `ended` | the player reached the end of the media |
| video completed | enough unique coverage was watched (`WATCH_COMPLETION_THRESHOLD`, 0.95) |
| activity completed | the authored `completion.mode` is satisfied |

`completion.mode: 'watch'` now gates on video completion instead of on `ended`.
The threshold is 0.95 rather than 1.0 because the last frames are routinely never
reported — players stop firing time events short of the end, or deliver `ended`
from a fraction of a second early — so demanding the full duration would make
watch-completion unreachable on some providers.

It is an internal constant, not an editor control: no schema field is added, no
migration is needed, and existing documents keep their `completion.mode` values
untouched. A configurable per-activity threshold is deliberately left as future
work; adding a control now would expand this PR without evidence that authors
want to tune it.

When the provider reports no duration (some do not), progress has no honest
denominator, so `isVideoCompleted` falls back to the `ended` event — the
behaviour activities had before this change. "Unknown" must never be read as
"complete".

### Reporting the score

The score is reported through the same public flow every other gradable iDevice
uses, and no second emitter is introduced:

1. `gamification.scorm.registerActivity(options)` once when the instance binds —
   it resolves the iDevice identity from the DOM, restores a previous SCORM
   score and is what the xAPI emitter uses to know which iDevice this is.
2. `gamification.scorm.sendScoreNew(true, options)` whenever the reported value
   changes — this is the call that emits the per-iDevice xAPI `answered`
   statement (`common.js`, via `gamification.track`) and updates SCORM.

`options` is not a shape of our own: `main` must be this instance's container id
(the shared layer resolves it as `$('#' + main)`, which also keeps several videos
on one page reporting as themselves), and `scorerp`, `weighted` and `msgs` are
read directly by the shared layer. An earlier version of this runtime passed
`{id, score, completed}`; that throws inside `registerActivity`, and because the
call is guarded the score vanished silently — no SCORM, no xAPI. The `msgs` map
is also how the author's Custom texts reach the shared layer.

`auto` is `true`: this iDevice has no manual "save score" button, so the score
saves itself and no `alert()` is shown. Nothing is reported until there is
something to report — a learner who only presses play produces no statement —
and an unchanged score is never sent twice. Every tracking call is wrapped: a
failing LMS must never stop the video.

### The idle panel, and what a seek does

The panel is always present so the video never resizes when an interaction
arrives. What it says while idle depends on who is looking: "Interactions will
appear here" is authoring guidance, so it is rendered only inside the workarea
(`eXe.app.isInExe()`, which is false in both the preview iframe and an exported
page). A learner sees an empty panel holding its space, styled without a border
so it does not read as an empty box. The "This video has no interactive
elements" message is different — that one IS for the learner, and stays.

Seeking does **not** dismiss a shown interaction. That was verified against the
iDevice on `main` by driving its preview: the slide stays through a forward
seek, a backward seek and a replay past it. Its runtime agrees — the only
hide-on-seek path in `checkSlides()` is commented out, with the note
"error: It hides the slide". The reasoning holds for the new one too: a pausing
interaction is a gate, not a notification, and letting a drag of the scrub bar
dismiss it would make every question skippable.

Rewinding, on the other hand, re-arms everything: only the cover and jumps are
consumed once and for all, so an interaction fires whenever the clock crosses its
time and a backward seek puts `lastTime` behind it again. A learner who rewinds
to re-read a note sees it, and one who rewinds to a question is asked it again —
answering a second time simply replaces the score. Crossing forward can only
happen once without a rewind, so nothing repeats on its own.

### One resolved document per instance

A legacy activity keeps its video URL **only** in the data island; the old model
never stored it in the properties. The engine renders the view while the island
is still inside the iDevice node, then replaces that node's innerHTML with the
output — so by the time `renderBehaviour` runs, the island is gone.

Re-resolving the document at that point therefore produced a *different* one:
provider `local`, empty URL, and only the interactions the properties happened to
carry. The view had painted a correct YouTube player that nothing was driving,
and the adapter degraded silently. Reported against a real CEDEC package
("campaña de denuncia", a YouTube activity with three timed text slides).

`renderView` now records the document it resolved per iDevice id, and
`renderBehaviour` drives that one. One resolution, one source of truth, and
multiple activities on a page stay independent because the cache is keyed by id.
This affected exported content exactly as much as the preview.

### Deliberately out of scope

Full xAPI Video Profile statements (`played`, `paused`, `seeked`, `completed`,
`terminated`, `played-segments` extensions), per-question `answered` statements
with interaction types, stable video Activity IDs and a telemetry event bus are
**not** part of this work. The pure segment tracking and completion semantics
here are the foundation they would need; the events themselves should be
designed with a real consumer in hand rather than speculatively.

## Migration and compatibility

A single pure, idempotent, forward-only migration (`hydrateDocument` in
`src/shared/schema.ts`):

1. Locate `#exe-interactive-video-contents` (`<script>` or legacy `<div>`);
   safe-parse (control-char scrub + `JSON.parse` in `try/catch`, `{slides:[]}`
   on failure — never throw).
2. Read the video href from the sibling
   `<p id="exe-interactive-video-file"><a href>` and detect
   `{provider, url, videoId}`.
3. Dispatch by version: `schemaVersion === 2` → normalize field by field
   (**idempotent**); `schemaVersion > 2` → `unsupported-version`, preserving the
   payload untouched; anything else is legacy and migrates DIRECTLY to v2
   (`migrateLegacyToV2`): `text` → `note`; `image` → `note` + `asset`; choice
   kinds and the advanced kinds → `question` already in final form (trueFalse
   `solution`, cloze/dropdown `segments`, singleChoice first-correct-wins);
   unknown → `unsupported` (verbatim `raw`); stable ids in original order; the
   legacy opener/poster becomes the singleton `cover` interaction.

The migration runs **once, on open** in the editor (never at export).
**Already-generated exports are untouched** — they embed the old runtime and
keep working. Tests assert `migrate(migrate(x))` deep-equals `migrate(x)` and
lossless `unsupported` round-trips.

## Security and privacy

- Declarative runtime data only: no author-JS `eval`, no inline/external author
  `<script>` in exported content (ADR-2236-03).
- External providers are untrusted cross-origin: store `{provider, videoId}`,
  rebuild canonical URLs, reject `javascript:`/non-HTTPS (ADR-2236-04).
- No same-origin assumption between exported content and the LMS parent; assume
  `window.origin` may be `"null"` under an opaque sandbox.
- Author content is escaped on render: question prompts (all kinds) and
  cloze/dropdown segments render as escaped text only; runtime-generated markup
  escapes every interpolated value.
- **Known residual:** `interaction.body` (note/pause body) renders as HTML
  because the legacy migration deliberately carries legacy TinyMCE note content into
  it (escaping would visibly break every migrated legacy note; the legacy
  runtime rendered the same HTML). New content authored in the plain
  `#ivDetailBody` textarea is stored as typed. Follow-up: route `body` through
  the shared DOM-based sanitizer once the classic-script runtime can consume it
  (no regex HTML scrubbing).

## Accessibility

WCAG 2.2 AA-oriented (the project ships no axe, so accessibility is gated by
hand-written role/keyboard/aria assertions):

- Native controls, visible focus, logical tab order, no keyboard trap.
- Time entry via a labelled field plus a "Use current time" button.
- Runtime interactions fully keyboard-operable; reorder/sort uses real
  Move-up/Move-down buttons (≥ 24×24), never drag-only; no `aria-grabbed`.
- `aria-live`/`role="status"` for correct/incorrect and running score.
- Question groups labelled (`<fieldset>`/`role=radiogroup`); native `<video>`
  (local / Mediateca) emits `<track kind="captions">` per authored subtitle
  (WCAG 1.2.2). See *Subtitles / captions* below.
- Responsive units (no fixed 448/408/898 px); `prefers-reduced-motion`
  respected; color is never the sole cue.

### Subtitles / captions (relates to #2035 and #1763)

The editor authors subtitle tracks in the Video tab (media-library picker per
track + language code, label and a single default), stored as
`video.captions[] = [{src, lang, label, default}]` and normalized by the core
(`normalizeCaptions`). The runtime renders them as native `<video><track
kind="captions">` — no player library. This is deliberately aligned with two
in-flight PRs:

- **#2035 (SRT→VTT):** the shared subtitle pipeline (`src/shared/utils/srt-to-vtt.ts`
  + `BaseExporter`/`Html5Exporter`) converts `.srt` subtitle **assets** to WebVTT
  and rewrites `<track src>` to the `.vtt` export path at export/preview — keyed by
  asset, so this iDevice's `<track>` is handled with no iDevice-specific code.
  Authors may therefore supply `.vtt` today, or `.srt` once #2035 lands (which also
  enables `.srt`/`.vtt` upload in AssetManager). This branch ships the authoring +
  data model + `<track>` rendering; the SRT→VTT conversion arrives with #2035.
- **#1763 (MediaElement removal):** the refactor already plays on native `<video>`
  with no MediaElement dependency (unlike the legacy player, one of the three
  MediaElement consumers), so it needs nothing from #1763 — it is already on the
  target native-`<track>` path (consistent with #2035 reverting the legacy
  MediaElement caption workaround).

## Internationalization

All editor and runtime strings via `_()` / `c_()` / `| trans`; no hardcoded
Spanish. The baked-in per-instance dictionary is dropped in favour of runtime
resolution, with a **Custom texts** tab (`getLanguageTab`) letting authors
override runtime labels (stored in `customTexts`). `translations/**` is never
edited by this work.

## Performance

Event-driven scheduling replaces the 500 ms `setInterval` poll of the legacy
runtime: local video schedules from native `timeupdate`, and external embeds from
the provider's push events (YouTube `infoDelivery`, Vimeo `timeupdate`), with no
polling on either path. Rendering is a single declarative pass;
grading/completion are pure O(n) over interactions. No provider SDK is loaded,
reducing exported-page weight and network requests.

## Testing strategy

TDD; colocated tests. The suites that gate this design:

- **Pure core + runtime + editor + providers** (Vitest, happy-dom):
  `npx vitest run public/files/perm/idevices/base/interactive-video --config vitest.config.mts`
  — time/provider/schema+migration/scheduling/grading for all 8 kinds, runtime
  render/grade, editor authoring, and the generated-bundle contract tests
  (`src/test/bundle-contract.spec.ts`) that evaluate the compiled bundles. The
  review-driven additions: table-driven legacy→v2 migration cases (singleChoice first-correct-wins, trueFalse answers→solution
  both ways, HTML-prompt→segments including `<s>`/`<strike>`/`<del>` and
  double-escaped recovery, plus idempotency and malformed input);
  `gradeTrueFalse` and prompt-text round-trip (`parsePromptText` /
  `segmentsToPromptText` with repeated words, punctuation, Unicode/accents and
  `'|'` variants); editor tests for singleChoice radio exclusivity, the dedicated
  True/False control, and no `<span` ever in the textarea or stored model; export
  tests for True/False grading both ways, cloze/dropdown rendered from segments
  (incl. the legacy `<s>` fallback) and escaped-prompt inertness; and provider
  tests (fake iframe/`contentWindow` harness) asserting the handshake posts,
  command `targetOrigin`, wrong-origin/wrong-source/malformed messages ignored,
  listener removal on `destroy`, two-instance isolation, and `embedUrl` shapes
  (including `origin` omitted for `'null'`).
- **Registration** (Bun): `idevice-config-browser.spec.ts` asserts the iDevice
  resolves to its single self-contained bundle, plus the filesystem contract
  test that every `component-type=json` iDevice's extra `export/` scripts are
  registered.
- **E2E** (Playwright, chromium):
  `bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/interactive-video.spec.ts`
  — inline three-tab editor with no detached popup; keyboard-only authoring;
  single-editor accordion; question-model authoring (radio exclusivity, dedicated
  True/False, `[[…]]` cloze tokens); "Use current time" from the live playhead;
  and a workarea-Preview step where a **local-video** activity pauses at t=1s,
  shows the question overlay, grades it and resumes (asserting the
  `interactive-video.js` bundle script tag in the preview document). The YouTube test asserts the controllable
  `enablejsapi=1` nocookie embed markup only — CI never depends on live provider
  network access; cross-origin control is verified at unit level with a
  deterministic fake-iframe postMessage harness.
- **No regressions** in the edited registration surfaces (`exe_export.test.js`,
  `idevice-config-browser.spec.ts`, legacy import `handlers.spec.ts`).

Verified results (2026-07-10, review-fix branch head):

```text
make fix                                   → exit 0 (no fixes needed)
make bundle                                → exit 0 (fresh exporters/libs/idevices bundles)
make test-unit                             → 7 453 backend tests pass; coverage gate: all 220 files ≥ 90 %
bun run test:frontend                      → 13 947 tests / 249 files pass (full Vitest suite)
npx vitest run …/interactive-video         → 278 tests / 4 files pass (iDevice suites)
DB_PATH=:memory: … bun test ./test/integration → 721 pass / 0 fail
bun test src/shared/export/browser/        → 77 pass / 0 fail (registry + contract)
bun x playwright test … interactive-video.spec.ts --project=chromium → 7/7 pass (~24 s, run twice)
```

Coverage caveat: `vitest.config.mts` excludes `public/files/perm/**` from
instrumentation, so the ≥ 90 % patch gate is diff-verified rather than reported
by `make test-coverage` (as `slide` already lives with).

## Rollout plan

1. Land the pure core (schema/migration/URL/time/sort/grade), TDD.
2. Land the declarative runtime.
3. Land the inline editor tab-by-tab.
4. Rewrite the E2E spec for the inline flow; register the iDevice as JSON.
5. Remove the detached editor after parity + green E2E.

Element-scoped state makes the iDevice multi-instance safe, so no rollout flag is
needed.

## Risks and mitigations

- **Storage format flip** → bounded on-open migration + round-trip fixtures;
  legacy island reader kept for hydration (ADR-2236-02).
- **All 8 kinds** → larger UI/test surface; each kind is unit-tested.
- **Mediateca** → mixed-content/keyed CDN, not bridge-promotable; retained
  hardened (HTTPS) and documented as limited (ADR-2236-04).
- **SCORM regression** → grading/completion locked behind pure unit tests before
  the markup rewrite.

## Open questions

- External-provider timing **no longer waits for PR #1968** in non-opaque
  contexts: the SDK-free provider adapter drives pause/seek/time events directly
  today. The bridge remains only the **opaque-mode** path, selected by a
  feature-detection seam (`createAdapter` factory today; the parent bridge globals
  when present), so the two paths can land independently.
- Whether to add `@axe-core/playwright` (dev-only) for automated a11y assertions
  — currently gated by hand-written checks.

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Native inline editor (replace the detached full-screen editor) | ADR-2236-01 | Proposed |
| Store data as versioned JSON properties + on-open migration | ADR-2236-02 | Proposed |
| Declarative, script-free learner runtime | ADR-2236-03 | Proposed |
| Normalize external providers behind an adapter boundary | ADR-2236-04 | Proposed |
| Keep the iDevice framework-free | ADR-2236-05 | Proposed |

## Evidence

Under `public/files/perm/idevices/base/interactive-video/` (line references and
counts are re-verified at the final review commit of PR #2147):

- `config.xml` — `component-type=json`, `api-version=3.0`,
  `edition-js`/`export-js` = [`interactive-video.js`] each,
  `export-template-filename=interactive-video.html`.
- `src/` — the maintained TypeScript sources with colocated `*.spec.ts`
  (see the TypeScript amendment for the layout); `tsconfig.json` — the strict
  per-iDevice compiler configuration.
- `scripts/build-idevices.ts` — the centralized TypeScript-iDevice build;
  compiles `edition/interactive-video.js` and `export/interactive-video.js`
  (both gitignored, plus their `.js.map`).
- `export/interactive-video.html` — the export template.
- Registration: `public/app/common/exe_export.js` (`jsonOnlyIdevices`) and
  `src/shared/export/browser/idevice-config-browser.ts` (`jsonIdevices`; the
  bundle is self-contained, so no `IDEVICE_JS_DEPENDENCIES` entry).
- E2E: `test/e2e/playwright/specs/idevices/interactive-video.spec.ts`.
- PR: [#2147](https://github.com/exelearning/exelearning/pull/2147).

## Acceptance criteria

Review-driven criteria (one per review item; verified 2026-07-10 by the suites
in *Testing strategy* — reviewer re-verification pending):

- [x] **(Item 1)** The editor's first tab is **General settings**, ordered
  a collapsed **Options** fieldset (behaviour/scoring + progress
  report) → **Video** fieldset → **Interactions** fieldset (before/after text
  boxes were later removed in favour of sibling Text iDevices — see *Editor
  architecture*); the
  standalone Preview tab is removed and only General settings / Custom texts /
  SCORM remain. *(edition unit tests + E2E test 1)*
- [x] **(Item 2)** "Use current time" fills the time field from the live playhead
  via the adapter for local video (E2E-verified) and for YouTube/Vimeo/Mediateca
  (unit-verified through the deterministic postMessage/fake-iframe harness), and
  surfaces a clear message when the adapter is unavailable/degraded — never a
  silent no-op. *(edition + providers unit tests; E2E test 6)*
- [x] **(Item 3)** `singleChoice` enforces **exactly one** correct answer via an
  exclusive radio control; `save()` rejects zero-or-multiple correct.
  *(edition unit tests; E2E test 3)*
- [x] **(Item 4)** `trueFalse` is authored with a **dedicated** True/False control
  writing `question.solution` (default True), not the shared multiple-choice
  answer rows. *(core/edition/export unit tests; E2E test 4)*
- [x] **(Item 5)** The cloze/dropdown prompt editor uses plain-text `[[…]]` tokens
  and never contains, persists or displays `<span>` line-through markup; the
  canonical storage is the `segments` model. *(core/edition/export unit tests;
  E2E test 5 uses the reviewer's exact "el caballo blanco" repro)*
- [x] **(Item 6)** Interactions use a single-editor accordion — each interaction is
  rendered once and edited in place — with keyboard operability and the defined
  focus-management contract; the dual list is gone. *(edition unit tests; E2E test 2)*
- [x] **(Item 7)** In workarea Preview and browser exports the video **pauses** and
  questions appear at their timestamps; external providers get the same scheduler
  through the adapters (registration entry present; core-load failure logs
  loudly). *(registry + runtime unit tests; E2E test 6 exercises the full
  SW-preview pause/answer/resume path)*

Baseline criteria (re-verified at the same commit):

- [x] Integrated, accessible, framework-free authoring UI; no detached editor /
  full-screen popup.
- [x] Versioned data model (`schemaVersion: 2`, the only published schema) +
  idempotent, lossless DIRECT migration from the original legacy shapes.
- [x] Deterministic declarative runtime; export/preview/SCORM compatibility
  preserved.
- [x] External providers behind the adapter boundary; no external `<script>` in
  exported content.
- [x] Unit + component + E2E coverage for the new flows; no skipped tests.
- [x] `make fix` clean.

## Implementation checklist

All review-driven items landed 2026-07-10 (suites in *Testing strategy*):

- [x] Pure core at `schemaVersion: 2` (direct legacy→v2 migration,
  `gradeTrueFalse`, `parsePromptText`/`segmentsToPromptText`) with tests.
- [x] Provider adapters (`src/providers/`, compiled into both bundles) with the
  SDK-free postMessage transports and tests.
- [x] Declarative runtime rewired to the shared adapter-fed scheduler for every
  provider, with the multi-instance id fix and loud core-load failure.
- [x] Inline editor with the **General settings**-first tab structure, the
  single-editor accordion, and the per-kind controls (singleChoice exclusivity,
  dedicated True/False, plain-text cloze/dropdown) with tests.
- [x] JSON-type registration + export template + the filesystem contract test
  (the bundle is self-contained; no extra script registration needed).
- [x] Rewritten E2E spec for the single-editor flow, including the SW-preview
  pause/question/resume step (local video) and the controllable-embed markup
  assertion for YouTube (no live provider network in CI).
- [x] Docs amended in this SDD + ADR-2236-01…ADR-2236-05 (review-driven pass).

## References

- PR [#2147](https://github.com/exelearning/exelearning/pull/2147) — Interactive
  Video iDevice refactor (this design).
- PR [#2149](https://github.com/exelearning/exelearning/pull/2149) — ADR/SDD
  workflow this record follows.
- ADR-2236-01 … ADR-2236-05 (this design's durable decisions).
- `doc/elpx-format/idevices/patterns.md`, `doc/elpx-format/idevices/catalog.md`.
