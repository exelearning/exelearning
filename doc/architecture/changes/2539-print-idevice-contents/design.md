---
tracking_issue: 2539
title: "Printing interactive activities as paper exercises"
status: in-review
date: 2026-09-20
authors:
  - "@mnarvaezm"
reviewers:
  - "@mnarvaezm"
implementation_prs: [2539]
related_adrs: [ADR-2539-01, ADR-2539-02]
supersedes: []
superseded_by: []
ai_assistance:
  tool: Claude Code
  model: Claude Opus 5
---

# Printing interactive activities as paper exercises

## Goal

Let a teacher print the unit they built: the prose as it stands, and the interactive activities as
exercises a student can complete on paper rather than as half-played game boards.

Two durable decisions sit behind this, both recorded as ADRs:

- [ADR-2539-01](../../adr/ADR-2539-01-generate-printable-content-from-idevice-data.md)
  — printable content is built from each iDevice's **stored data**, not from its rendered HTML.
- [ADR-2539-02](../../adr/ADR-2539-02-choose-how-interactive-activities-print.md)
  — printing is **one document**, and what happens to the interactive activities is chosen at
  print time.

This document covers how both are implemented.

## Scope

| | |
|---|---|
| iDevices with a printable form | Twenty-nine: every interactive activity except the eleven settled as unprintable |
| Interactive activities in total | 40 of the 52 iDevices; eleven of those say they are not available in print |
| Printing modes | Leave them out · in place · in an appendix · only the activities |
| Answer key | Not in this phase |
| Writes to the project | None — both paths are read-only |

## How activity data is stored

Two families, and there are adapters for both.

**DataGame family (31 iDevices).** `component.content` is HTML holding a hidden div with the whole
activity as JSON, obfuscated with XOR key 146 followed by `escape()`:

```html
<div class="adivina-DataGame js-hidden">%E9%B0%E6%EB%E2%F7%D5%F3%FF%F7%B0…</div>
```

**jsonProperties family (~15 iDevices).** Data sits unobfuscated in `component.properties`, and the
component's own HTML is an empty shell. Four of them — `adaptative-quiz`, `form`, `trueorfalse`,
`scrambled-list` — are activities all the same, and all four print. An adapter used to be handed
only the markup; the properties are now handed over with it, which was the whole of what the family
needed. The model absorbed their question shapes without change.

### Two traps

**The class prefix is not the iDevice type.** `component.type` is `guess` but the div is
`adivina-DataGame`. The same holds across the family (`complete`→`completa`,
`crossword`→`crucigrama`, `classify`→`clasifica`,
`quick-questions-multiple-choice`→`selecciona`). Each adapter states its own prefix; it cannot be
derived.

**Media URLs inside the payload are stale.** The export pipeline rewrites `asset://UUID`
references by scanning plain HTML and cannot see inside the obfuscated payload. iDevices therefore
duplicate each reference as a sidecar link whose text is the question index:

```html
<a href="asset://UUID" class="js-hidden adivina-LinkImages">3</a>
```

Text and structure come from the payload; **media URLs come from the sidecars**. The activity's own
runtime does the same when it loads, including its rule that an href shorter than 4 characters
means "no picture".

## Architecture

### Building an exercise

```
component.content
   │
   ▼ adapter registry          type → adapter
   │
   ▼ PrintableActivity         neutral model
   │
   ▼ WorksheetRenderer         model → markup (+ the CSS that markup needs)
```

### The two consumers

```
File → Print
   │
   ▼ listInteractiveActivities → the options panel beside the preview
   │
   ├─ "Activities only"                  └─ any other choice
   │                                        │
   ▼ WorksheetExporter                      ▼ PrintPreviewExporter
   │  walk, group by page                   │    preprocessPages  (asset:// → blob)
   ▼ renderWorksheet                        │    applyActivityMode ← the chosen mode
   │  standalone document                   │    renderSinglePage
   ▼ blob → preview overlay                 ▼ blob → preview overlay
```

The document path needs **no HTML surgery**. `applyActivityMode` works on the page model between
preprocessing and rendering: a component is dropped, has its content replaced by an exercise, or
has it replaced by a pointer into an appendix — and the appendix is a synthetic `ExportPage` that
goes through the ordinary rendering path.

Asset URLs are already resolved to blobs by that point, which is what lets a converted exercise
keep its pictures with no extra work.

### The model

```ts
interface PrintableActivity {
    ideviceType: string;
    title: string;        // the activity's name, kept for the model but never printed
    number?: number;      // only an appendix entry carries one
    instructions?: string;   // sanitised HTML
    board?: PrintableBoard;  // a shared answer space, above the questions
    items: PrintableItem[];
    textAfter?: string;      // sanitised HTML
}

interface PrintableItem {
    prompt: string;          // sanitised HTML
    media?: { kind: 'image'; src: string; alt?: string; author?: string; size?: 'normal' | 'small' };
    extraText?: string;      // sanitised HTML
    answer?: PrintableAnswer;  // absent when the activity answers into the board
    direction?: 'across' | 'down';
    number?: number;         // when it must match something outside the list
}

type PrintableAnswer =
    | { kind: 'characterBoxes'; groups: CharacterBoxGroup[] }   // null = empty box
    | { kind: 'writingSpace'; lines: number }
    | { kind: 'orderCards'; cards: PrintableCard[]; columns?: number; headers?: number }
    | { kind: 'options'; labels: string[]; marker?: 'box' | 'line' };

type PrintableBoard =
    | { kind: 'crosswordGrid'; rows: CrosswordCell[][]; background?: { src: string } }
    | { kind: 'wordBank'; words: string[] }
    | { kind: 'matchColumns'; cards: PrintableCard[]; containers: PrintableContainer[] }
    | { kind: 'groupColumns'; groups: { columns: PrintableCard[][]; headings?: string[]; aligned?: boolean }[] }
    | { kind: 'letterRing'; letters: { letter: string; active: boolean }[] }
    | { kind: 'wordGrid'; rows: string[][] }
    | { kind: 'operationTable'; rows: { operation: string; result: string | null }[] };

interface PrintableCard {
    text?: string;          // sanitised HTML
    media?: PrintableMedia;
    textColor?: string;     // already checked against the paper by cardColors
    accentColor?: string;   // drawn as an outline and a band, never as a fill
}
```

The board is what made the model general. An activity that answers question by question uses
`items[].answer`; one whose whole exercise is a single shared space — a crossword grid, two columns
to match up — puts it in `board` and may carry no items at all.

`lines` is still unrendered: the renderer throws for it rather than printing a silent blank, so
whoever writes the first adapter that needs one finds out immediately.

### Departures from what the activity does on screen

Each is deliberate and commented where it happens:

| Activity | On screen | On paper | Why |
|---|---|---|---|
| `crossword` | 20 randomised placement attempts | one compact placement | No printed grid could match a grid the runtime reshuffles |
| `quick-questions-multiple-choice` | tree order skips selection | tree order counts as random | The share of questions must still be honoured |
| `complete` | gap width 10 | gap width 12 when fixed | Room to write by hand |
| `dragdrop` | audio cards can be dragged | dropped, with their text | A sound clip has no paper equivalent |
| `dragdrop`, `classify` | one long pair of columns | blocks of five rows | A pair split across two sheets cannot be joined with a line |
| `az-quiz-game` | one clue wording drawn per play | one printed | A sheet reads like one round of the game |
| `word-search` | grid sized from the alphabetically first word | sized from the longest | The original is arbitrary; the longest is the true minimum |
| `sort` | cards dragged into place | numbered on a line under each | Paper cannot be dragged |
| `mathproblems` | a drawn value can overshoot the author's maximum | stays inside min–max | The range is the author's instruction, not an artefact of the arithmetic |
| `relate` | the card's colour fills it | a 3mm band and the outline, never a fill | A class set is thirty copies of it, and the words belong on white |
| `relate` | the font colour as chosen | dropped below 3:1 against paper | The author picked it against their own coloured card |
| `relate` | only the first `&percnt;` decoded | all of them | The runtime left the global flag off its regex; the rest print as the entity |
| `mathematicaloperations` | signs written `x` and `:` | `×`, `÷` and a true `−` | On paper the sign is the arithmetic, and `x` reads as an unknown |
| `mathematicaloperations` | a result redrawn until the settings allow it | the same, bounded, keeping the first attempt | Settings can ask for a result no draw satisfies |
| `adaptative-quiz` | the quiz walks levels, so no two learners see the same questions | as many as a learner answers (`numRound`), shared out between the levels from the initial one outwards, in stored order, difficulty left off; every question when no count is set | A sheet is printed once and handed out: it asks what one learner would, without following any one |
| `adaptative-quiz` | a sort question stores its options in the right order | shuffled, a line beside each | Printed in order, the list would be the answer — the Scrambled list rule |
| `padlock` | a combination opens a passage of the author's writing | the writing alone; a lock guarding none is reported as not available in print | There is no lock to open on paper; the combination, and the instructions for opening it, are never printed |
| `trueorfalse` | a hint waits behind a button | dropped | Printed, it reaches the student who would never have asked for it |
| `scrambled-list` | the elements are dragged into place | shuffled, each with a line beside it to write its position on | Numbering is the same judgement made with a pencil |
| `form` | four kinds of question in one questionnaire | true-or-false and options as boxes to tick, fill and dropdown as gaps in the author's own text | Each kind already has a paper form; only the grading is lost |
| `form` | a dropdown offers its choices at each blank | the same set offered at each gap | The activity builds one list per question and shows it at every blank |
| `periodic-table` | a table of 118 boxes, or the phone's one card at a time | only the cards, one per question, across the sheet | The table would fill the sheet and leave no room for the exercise; on a phone the activity draws no table either |
| `periodic-table` | the elements are drawn afresh on every load | the sheet draws its own set the same way | The activity stores which groups are in play, never which elements |
| `select-media-files` | cards are clicked and checked | a box beside each picture, its words below, laid across the sheet and centred | Choosing is the same act on paper; only the checking is lost |
| `select-media-files` | a card may be nothing but a sound | dropped | A box beside an empty space tells one card from no other |
| `select-media-files` | a blank card cap yields one card | no cap | Clearing a box is not a way of asking for one card, and one card is not an exercise |
| `rubric` | a table with text inputs, buttons and a running total | the table with every descriptor, the fields as blank rules, room for notes | Marking is done by ringing a cell; the controls print as empty boxes |
| `rubric` | the fields ask for activity, name, score and date | activity and score only | The sheet already asks for name and date at the top |
| `identify` | a picture to recognise, clues bought one at a time | the statement, then every clue in play, and blank room to name it in | Recognising the picture is the game; printed, it either gives the answer away or is too small to read |
| `identify` | the clue is called whatever the author called it | the same word, numbered | A sheet saying 'Hint' under an activity saying 'Sugerencia' is one activity with two voices |
| `challenge` | a room to escape, against a clock, unlocking one challenge at a time | the challenge and its smaller ones in stored order, each with a line of blank room | There is no clock and nothing to unlock; what is asked is a question with an answer |
| `challenge` | clues appear as the time runs down | dropped | All of them at once would answer the questions being asked |
| all | a video or an embed sits in the author's prose | dropped, and the paragraph that held it with it | An empty paragraph prints as a hole the size of what it replaced |
| `electrical-circuits` | the diagram is drawn from its TikZ source | the stored SVG, as an `<img>` data URI | A browser runs no script in an SVG loaded that way |
| `3dmol` | the molecule is turned with the mouse | one picture, from the camera the author left | There is no mouse on paper; the author framed what matters |
| `3dmol` | drawn at whatever size the viewer gets | about 300 dpi at 80 mm, and no more | Each picture travels inside the document as a data URI |
| all | video questions play | dropped before the share is applied | Nothing to answer on paper |

### Files

| File | Responsibility |
|---|---|
| `src/shared/export/worksheet/types.ts` | The model and the adapter interface |
| `src/shared/export/worksheet/dataGameReader.ts` | Payload extraction and the sidecar rule |
| `src/shared/export/worksheet/sanitizeHtml.ts` | Allow-list sanitiser over parse5 |
| `src/shared/export/worksheet/questionSelection.ts` | Share-of-questions and hint-letter draws |
| `src/shared/export/worksheet/crosswordLayout.ts` | Compact crossword placement |
| `src/shared/export/worksheet/wordSearchLayout.ts` | Word search grid, hidden words and fill |
| `src/shared/export/worksheet/mathProblemValues.ts` | Numbers drawn into a problem's statement |
| `src/shared/export/worksheet/mathOperations.ts` | A drill's sums, drawn from the activity's rules |
| `src/shared/export/worksheet/cardColors.ts` | An author's card colours, read for paper |
| `src/shared/export/worksheet/twoFacedCards.ts` | The card shape Relate and Flip cards share |
| `src/shared/export/worksheet/rubricTable.ts` | An assessment table, from either shape a project stores it in |
| `src/shared/export/worksheet/periodicElements.ts` | The 118 elements, ported from the activity's own table |
| `src/shared/export/worksheet/circuitImage.ts` | A stored diagram, carried as an image |
| `src/shared/export/worksheet/moleculeCapture.ts` | Drawing a stored molecule before the sheet is built |
| `public/app/common/MoleculeCapture.js` | The browser half of it: 3Dmol, off-screen, read back as a PNG |
| `src/shared/export/worksheet/interactiveActivities.ts` | What counts as an interactive activity |
| `src/shared/export/worksheet/WorksheetRenderer.ts` | Model → markup; the document, and one fragment |
| `src/shared/export/worksheet/adapters/*.ts` | One per iDevice, plus the registry |
| `src/shared/export/exporters/WorksheetExporter.ts` | Walks the document for the worksheet |
| `src/shared/export/exporters/printActivityModes.ts` | Applies the chosen mode to the pages |

Shared helpers extracted along the way, each previously duplicated:

| File | Was duplicated in |
|---|---|
| `src/shared/export/utils/dataGameCipher.ts` | `common.js`, `LatexPreRenderer.js`, `ServerLatexPreRenderer.ts`, `LibraryDetector.ts` |
| `src/shared/export/utils/AssetUrlResolver.ts` | `PrintPreviewExporter.ts` |
| `src/shared/export/utils/visibility.ts` | `PrintPreviewExporter.ts`, `IdeviceRenderer.ts` |

### Frontend

The print preview overlay serves both sources, since only the origin of the HTML differs: in
document mode it prints the project, and in worksheet mode (`PREVIEW_MODE_IDEVICES`) it builds the
worksheet. A second overlay would have duplicated loading, blob handling, printing, `Escape` and
cleanup to change one call.

**File → Print** is the only way in: the File menu has no *Print iDevices* entry. It lists the
project's interactive activities and opens the preview straight away, with an options panel beside
it. With none, the panel offers only the document options and the document prints as it always did.
With some, *What would you like to print?* offers four mutually exclusive choices, in this order:
*Content with activities* (preselected), *Content with activities in an appendix*, *Activities only
(no other content)* and *Content without activities*. *Activities only (no other content)* switches the
overlay to the worksheet. *Activities* then lists each one to tick or clear; those that can never be
printed are marked *Title only* and start cleared.

Translated strings are passed from `modalPrintPreview.js` into the shared code, because the export
layer's `trans()` is a pass-through. Nothing under `translations/` is touched.

### Two rules the implementation must keep

**The stylesheet is split.** `WORKSHEET_ACTIVITY_STYLES` holds only rules scoped to an activity, so
it can be injected into a document this renderer did not build. The rest — `@page`, the `*` box
reset, `body` — stays with the standalone worksheet, where owning the page is correct.

**The synthetic type must not be named after a worksheet class.** `IdeviceRenderer` turns a
component's type into a CSS class on the wrapper it emits, so a type called `worksheet-activity`
put that class on the wrapper *and* the exercise inside it. It is `printable-activity`, with a test
that fails if this is ever undone.

## Bugs found on the way

**`LibraryDetector._decrypt` used `decodeURIComponent`.** Every other copy used `unescape`, and
they are not interchangeable: XOR-146 pushes most ASCII above `0x7F`, and `escape()` emits those as
lone `%XX` bytes that `decodeURIComponent` rejects with `URIError`. Every real payload hit the
`catch`, returned `''`, and `exe_math_datagame` was never detected — so LaTeX inside gamified
activities never pulled MathJax into an export. The tests passed because their own helper encoded
with `encodeURIComponent`, matching the broken decoder rather than the real producer.

**`digcompedu` and `lomloe` were missing from the browser shim's list of JSON iDevices.** Both
declare `<component-type>json</component-type>` in their `config.xml`, so the browser called them
`html` while the server called them `json`. With them added, the shim agrees with `config.xml` for
all 52 iDevices in both directions.

## What this phase leaves out

The answer key and PDF/ODT export. Every interactive iDevice now has a paper form: the last of them
was the padlock, and the jsonProperties family went the same way, `form` being the first of it to
print. Eleven iDevices are outside it for good, and say so rather than promising a printed form
for later.

With none left, the tests that need an activity without an adapter use a type no iDevice answers
to. That is the better fixture anyway — what they are about is what happens to an activity with no
paper form, not which activity happens to lack one this month.

## Validation

- Unit tests per layer; each adapter covers its question types, its degenerate payloads and
  injected markup.
- `test/e2e/playwright/specs/print-idevices.spec.ts` prints `test/fixtures/old_el_cid.elp` and
  asserts its real numbers: 8 questions, 26 box groups, 130 boxes, reaching the worksheet from the
  preview's panel. Further cases cover the panel and the four modes, including that each appendix
  pointer carries the number of the exercise at the back.
- Manual: pictures resolve, accents survive, no question splits across sheets.
