---
id: ADR-2492-01
title: "Keep each iDevice's saved game under its own component id, without carrying over games saved before"
status: Proposed
date: 2026-09-28
tracking_issue: 2492
deciders:
  - "@mnarvaezm"
reviewers: []
related:
  prs: [2492]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: Claude Code
  model: claude-opus-5-5
---

# ADR-2492-01: Keep each iDevice's saved game under its own component id, without carrying over games saved before

## Context

Four iDevices keep the learner's progress in the browser's `localStorage`, so that a learner who
leaves the page finds the activity where they left it: challenge, trivial, padlock and checklist.
Each one names its entry after an id carried inside the iDevice's own stored data:

| iDevice | Entry | Where the id comes from |
|---------|-------|-------------------------|
| challenge | `dataDesafio-<desafioID>` | Generated once when the iDevice is created (`edition/challenge.js:40`) and kept as stored on every later edit (`updateFieldGame`, `:813`). |
| trivial | `dataTrivial-<trivialID>` | The same (`edition/trivial.js:57`, `:1665`). |
| padlock | `dataCandado-<id>` | Rewritten with the component id on every edit (`edition/padlock.js:254`); at runtime it falls back to the padlock's position on the page when missing. |
| checklist | `dataCotejo-<id>` | Rewritten with the component id on every edit (`edition/checklist.js:1003`); nothing is saved when missing. |

Duplicating an iDevice gives the copy a new component id but copies its markup verbatim, data
and ids included (`cloneComponentMap`, `public/app/yjs/YjsStructureBinding.js:1389`). The two
copies therefore name their entry after the same id:

- **challenge and trivial:** the copies share one saved game for good, whether edited or not. A
  learner who starts one finds the other resuming that game, in the editor and in the exported
  site.
- **checklist:** until the copy is edited, both lists read and write one entry. Ticking an item
  on one ticks it on the other.
- **padlock:** the entry was also read and written under different names.
  `updateEvaluationIcon` replaces `mOptions.id` with the component id half a second after loading
  (`public/app/common/common.js:2200`). So the state was written under the component id and read
  back under the data's id. An unedited copy came back with the original's time and result, and
  a padlock whose data had no id never found its own state.

The component id is unique in the project and is the same in the editor and once exported: the
exporter writes it as the `id` of each `.idevice_node` (`src/shared/export/renderers/IdeviceRenderer.ts:160`,
`:244`). Rubric already names its entry after it (`getStorageKey`, `rubric/export/rubric.js:836`).

## Problem

Under what name should an iDevice keep its saved game, so that copies never share one? And
what happens to the games already saved under the old names?

## Decision drivers

- Every copy of an iDevice must keep its own progress, including copies in projects that exist
  today and copies nobody edits after duplicating.
- No change to the project format (ELP/ELPX) and no rewrite of existing content.
- Duplication stays a generic operation. The core must not learn the data format of each
  iDevice, much of which is encrypted.
- Carrying over games already in progress is not required: the fix is for what learners play
  from now on.

## Options considered

### Option 1: Give the copy new ids when duplicating

`cloneComponentMap` would decode each iDevice's data and rewrite `desafioID`, `trivialID` or
`id`.

- Pros: the stored data becomes correct.
- Cons:
  - The generic clone path would need per-iDevice knowledge of formats that are often encrypted.
  - It does nothing for copies already in projects, nor for iDevices pasted or imported from
    another project.
  - Discarded while the decision was being made.

### Option 2: Write the component id into the data when the copy is edited

padlock and checklist already do this; challenge and trivial would follow.

- Pros: small change in each editor.
- Cons:
  - A copy nobody edits keeps sharing.
  - Every existing project needs an author to open every copy.

### Option 3: Name the entry after the component id at runtime (chosen)

Each of the four runtimes names its entry
`'<prefix>-' + $(activity).closest('.idevice_node').attr('id')`, keeping its existing prefix.
An iDevice outside any component gets no name, and nothing is saved or read for it.

- Pros:
  - Works for every copy, old or new, edited or not, as soon as the project is exported with
    this version.
  - No change to content or to the clone path.
- Cons:
  - Games saved under the old names are no longer found (see Option 4).

### Option 4: Option 3, falling back to the old name when the new one is empty

- Pros: a learner's game in progress would survive the update.
- Cons:
  - The old name is precisely the shared one. The first time a copy loads, it has no entry of
    its own, so it would adopt the original's game: the fallback brings the bug back.
  - Telling the rightful owner of an old entry apart is impossible for challenge and trivial,
    whose copies carry identical ids.

## Evidence

PR #2492, branch `fix-idevice-timers-per-instance`:

- Commits: `91fec266d` (challenge), `4e80d9fe3` (trivial), `df1102866` (padlock), `12d78add4`
  (checklist).
- `6cf7fffb5` (padlock) is related: on a page with several padlocks, only the last one saved its
  state when the page was left.
- The `storageKeyOf` of each runtime: `challenge/export/challenge.js:97`,
  `trivial/export/trivial.js:132`, `padlock/export/padlock.js:69`,
  `checklist/export/checklist.js:63` (paths under `public/files/perm/idevices/base/`).
- Unit tests in each iDevice's `export/*.test.js` check that each copy uses its own entry, that
  it never reads another copy's, and that nothing is saved without a component.
- E2E specs under `test/e2e/playwright/specs/idevices/`: `challenge-timers`, `trivial-timers`,
  `padlock-timers`, `padlock-storage` and `checklist-storage`.
  - Both copies are created with the first component's id in their data
    (`COMPONENT_IDS`, `test/e2e/playwright/helpers/idevice-clock-helpers.ts`), as an unedited
    duplicate carries it.
  - Each spec fails against the previous runtime and passes with this one.

## Decision

- challenge, trivial, padlock and checklist keep the learner's saved game in `localStorage`
  under `<prefix>-<component id>`: `dataDesafio-`, `dataTrivial-`, `dataCandado-`, `dataCotejo-`.
  The component id is read at runtime from the enclosing `.idevice_node`.
- An iDevice with no component saves nothing.
- **Games saved under the old names are not carried over.** They are not read, moved or deleted.
- Neither the stored ids (`desafioID`, `trivialID`, `id`) nor existing projects are rewritten.

## Consequences

### Positive

- Copies of these iDevices keep separate progress, on the same page or on different pages.
- It covers copies duplicated before this change and never edited since.
- A padlock returns with its own time and result: its saved state is read and written under the
  same name.
- Re-exporting an existing project is enough to apply the change; nobody has to edit anything.

### Negative

- **Expected behaviour, not a regression:** when a project is re-exported with this version, a
  learner who had one of these activities in progress in their browser starts it anew, once:
  - challenge restarts its challenges and its clock;
  - trivial restarts the board;
  - checklist shows its items unticked and its name and date empty;
  - padlock starts with its full time, as it mostly did already, since it never found its
    saved state.

  The mark already sent to the LMS is not lost: it is reported through the SCORM layer, not kept
  in these entries.
- The old entries stay in the learner's browser, unused, until the browser's storage is cleared.

### Neutral

- Packages exported before this change keep their own copy of the old runtime and behave as
  before until they are exported again.
- The ids in the stored data stay in place, unused for storage.
- progress-report keeps reading `dataEvaluation-<evaluationID>`. That entry is shared on
  purpose: it collects the activities of one evaluation. It is outside this decision.

## Risks

- **An iDevice rendered outside a `.idevice_node` loses its resume** (low likelihood, low
  severity). The editor and the exporter always render the wrapper; custom markup that skips it
  would play without saving.
- **Support may report the one-time restart as a bug** (medium likelihood, low severity).
  Mitigated by this ADR and by a changelog entry.

## Validation

- The unit tests and E2E specs listed under Evidence run in CI.
- The E2E specs reproduce an unedited duplicate, the case that shared state before.

## Follow-up work

- Add a line to `public/CHANGELOG.md` saying that games in progress in challenge, trivial,
  padlock and checklist start anew once after updating.

## References

- PR #2492
- `public/app/yjs/YjsStructureBinding.js` (`cloneComponentMap`)
- `public/app/common/common.js` (`updateEvaluationIcon`)
- `src/shared/export/renderers/IdeviceRenderer.ts`
- `public/files/perm/idevices/base/{challenge,trivial,padlock,checklist}/{edition,export}/`
- `public/files/perm/idevices/base/rubric/export/rubric.js` (`getStorageKey`)
- `test/e2e/playwright/helpers/idevice-clock-helpers.ts`
