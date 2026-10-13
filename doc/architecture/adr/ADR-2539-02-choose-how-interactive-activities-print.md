---
id: ADR-2539-02
title: "Choose how interactive activities print, as part of the document"
status: Proposed
date: 2026-10-11
tracking_issue: 2539
deciders:
  - "@mnarvaezm"
reviewers:
  - "@mnarvaezm"
related:
  prs: [2539]
  changes: ["2539-print-idevice-contents"]
  adrs: [ADR-2539-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: Claude Code
  model: claude-opus-5-5
---

# ADR-2539-02: Choose how interactive activities print, as part of the document

## Context

[ADR-2539-01](ADR-2539-01-generate-printable-content-from-idevice-data.md) decided
*how* to make an interactive activity printable: read its stored data and build an exercise from
it. It left the two printing paths side by side, reachable from two menu entries:

- **File → Print** opens `PrintPreviewExporter` and prints the project as the browser draws it.
- **File → Print iDevices** opens `WorksheetExporter` and prints the activities, alone.

So a teacher printing a unit chooses between prose with unusable game boards in it, and exercises
with none of the prose around them. Neither is the handout they wanted.

## Problem

How should the printed document treat an interactive activity — and who decides?

## Decision drivers

- **One handout.** The text and its exercises belong in the same document.
- **There is no single right answer.** Some teachers want the exercises in place, some want them
  detached at the back so the text can be read first, some want the text alone.
- **Not every activity has a printed form.** Some are waiting for an adapter; others never will
  have one. Whatever we decide has to be honest about both rather than leave a hole in the handout.
- **Do not disturb the common case.** A project with no interactive activity must have nothing to
  decide before printing.
- **Definition must be single-source.** "Interactive" cannot become a hand-maintained list that
  drifts from the iDevices themselves.

## Options considered

### Option 1: Keep the two paths separate (the status quo)

- Pros: nothing to build.
- Cons: neither output is the handout. The teacher has to print twice and interleave by hand.

### Option 2: Always convert interactive activities in place

Print one document, with every interactive activity replaced by its printable exercise.

- Pros: one menu entry, no question asked, the obvious output.
- Cons: forces a single answer on a question that has three reasonable ones. A teacher who wants
  the exercises at the back, or a reading with no exercises, cannot get it.

### Option 3: Add three more menu entries

- Cons: four print entries in the File menu, three of which are wrong for any given teacher, and
  all four still present when the project has no interactive activity at all.

### Option 4: Ask in a dialog before the preview

Detect interactive activities when Print is chosen. If there are none, open the preview as now. If
there are, ask in a dialog what to do with them, then open the preview of the result.

- Pros: the question is asked only when it applies.
- Cons: a second window between the user and the preview. The answer is given before its result
  can be seen, and trying another one means closing the preview and starting again.

This was the first cut, and it was replaced by option 5.

### Option 5: Choose beside the preview

Open the preview at once, with a panel beside it holding the choices. The preview is drawn again
whenever one of them changes.

- Pros: no second window. Each choice is made looking at its result, and can be changed until the
  page looks right. A project with nothing to decide prints in one click from the preview.
- Cons: the preview is drawn again on every change, which a large project makes the user wait for.
  The panel takes width from the preview.

## Decision

**Printing is one document, and what happens to interactive activities is chosen beside the
preview (option 5).** It avoids a second window, and the preview opens at once with each choice
seen next to its effect, with no closing and reopening to try another.

File → Print opens the preview straight away, with an options panel docked beside it, as wide as the
Styles panel. When the project has interactive activities, the panel offers four mutually exclusive
choices:

| Choice | Result |
|---|---|
| Do not print them | The document without them |
| Print them where they are | Each activity printed as an exercise where the author put it |
| **Print them in an appendix** (default) | Title plus a cross-reference in place; the exercises numbered at the back |
| Print only the activities | The worksheet alone — what *Print iDevices* used to produce |

**The appendix is the default because both the text and the activities print better that way.** The
text runs on as the author wrote it, without exercises breaking it up, and in the appendix each
exercise starts on a page of its own. A pointer marks where each one was.

**Which activities print is chosen in the same panel.** While a choice prints activities, the panel
lists them all, ticked. Unticking one leaves it out of the document, or off the worksheet, as if the
author had not put it there. Print is disabled with none ticked, unless the choice is to print none.

**The panel also holds the document options**, which apply with or without activities: *Show link
URLs* (ticked), *Print all visible content* (clear; see "Folded is not hidden" below) and *Show
titles of non-printable activities* (clear, and shown only when the project has any). With no
interactive activity, these are all the panel offers, and nothing has to be changed before printing.

Every change draws the preview again after a short pause (250 ms), so ticking several activities in
a row draws it once, and Print is disabled while the preview is being drawn.

**"Interactive" is mostly derived, with the exceptions written down.** The common case comes from
`getIdeviceConfig(type).componentType === 'html'`, so a new iDevice is classified the day it is
added. Lists record where storage format and activity part company, each entry carrying its reason:

- **`html` but not an activity** — `udl-content` and `checklist`. They print correctly as they are.
- **`json` but an activity all the same** — `adaptative-quiz`, `form`, `trueorfalse` (also stored as
  `true-or-false`) and `scrambled-list`. They render from stored data, but what they render is an
  exercise the student works through.
- **Never printable** — see below. Being listed there is enough to count as an activity, whatever
  the component type: a magnifier stores JSON and a website embed is HTML, and both print as a broken
  widget.

The first list was longer. Downloads, embedded websites, the progress report and GeoGebra were in
it, on the grounds that they print as they are; but what they print is a button, a frame or a
report with nothing to report, so they moved to the never-printable list. The rubric left it when it
got an adapter.

The second list exists because the first cut of this decision used the derived rule alone, and
choosing "do not print them" then left four genuine activities printing as interfaces. How an
iDevice stores its data was never the question; whether the student has to work through it is.

**Everything that asks "is this an activity?" asks the same code.** The panel's list, the
document's modes and the worksheet's own list of what it could not print all go through the
classifier. The worksheet used to answer it for itself by looking for a `-DataGame` div in the
component's HTML, which is a test of the storage format wearing the question's clothes: the four
JSON activities have no such div, so widening the definition left them off the sheet with nothing
said about it. A second way of asking will drift from the first, and it drifted the day the
definition changed.

**An interactive activity that is restricted is left exactly as the document prints it.** Nothing
converted or moved may widen what the author hid: `novisible` and `teacher-only` are
`display: none` in the export stylesheet, so a copy that leaves its block loses the restriction
with it. The panel's list applies the same rule, so it never offers activities the modes will not
touch.

**What an exercise had to leave out is reported where the teacher can see it.** An adapter that
drops a question — one needing video, say — says so beside the exercise, in a note the export
stylesheet hides when printing. The worksheet path already reported these, and printing the
document should not be the quieter way to lose content.

**An activity without a printed form still prints.** A line stands in for it — in place, or in the
appendix where it also takes a number. A missing adapter must never turn into a silent hole in the
handout. Every interactive iDevice shipped today has either an adapter (29) or a settled answer
(11), so the line is left for an iDevice the classifier does not know and for data an adapter
cannot read.

**"Not yet" and "never" are two different messages.** An activity with no printed form is either
waiting for one, and the line says so, or will never have one. Eleven are of the second kind: a
board game played in turns, a map answered by placing things on it, a GeoGebra construction, a
progress report, a puzzle, an interactive video, a set of questions asked over a video, an embedded
website, a download button, a set of file attachments and a magnifier. Each is the interaction
itself, a reading of work done elsewhere, or something to click, and there is no paper version of
it to write. Their line says the activity is not available in print, full stop. Telling a teacher
to wait for a release that is not coming is worse than telling them no: they would keep checking.
The list lives beside the definition of what counts as interactive, with a reason recorded against
each entry, so the answer to "why is this one never printable" is in the code rather than in a
commit message.

**What can never be printed is left out unless asked for.** A handout dotted with "not available
in print" tells the student about the editor rather than about the subject, and unlike "not yet"
there is nothing to wait for: the hole is the decision, not a gap. So printing leaves these
activities out by default — of the panel's list, of the document, and of the worksheet's note for
the teacher — and *Show titles of non-printable activities* brings them back. Ticked, each comes
back as it was: its block's title and the note where the author put it, or a numbered entry in the
appendix with a pointer to it. A page that held nothing else keeps its title either way, as it does
when every activity is left out.

The exporters have no rule of their own for this. While the option is clear, the panel names the
activities to print and leaves these out of the list, and the exporters drop them as they drop any
activity the user unticked: a block left empty goes with its title, and the appendix is numbered
without a gap. Which activities they are comes from `isNeverPrintable`, through the same listing
that fills the panel.

Two near cases stay outside the option. A padlock prints the writing it guards; one that guards
none says it is not available, but that is about the component, not about padlocks, so the option
does not hide it. And "not yet" keeps its line whatever the option says: an iDevice the classifier
does not know, or data an adapter cannot read, is a problem the teacher has to see.

**An exercise is named after the block the author put it in, never after its iDevice.**
'CLASIFICA' above an exercise named the tool rather than the work. What names it is the author's
own heading — and the first cut of this decision removed the iDevice's name and left nothing in
its place, so the worksheet and the appendix printed exercises with no name at all.

The heading is therefore printed wherever the block does not draw its own: on the worksheet, and
on an appendix entry, where it joins the number the body points at. In place the block still draws
it, so repeating it would say the same thing twice. One function builds it for both paths, so they
cannot word it differently.

**Composition happens on the page model, never on generated HTML.** The mode is applied between
`preprocessPages()` and `renderSinglePage()`: components are removed, replaced by a printable
fragment, or replaced by a cross-reference, and the appendix is a synthetic `ExportPage` that goes
through the ordinary rendering path. A replaced component takes a synthetic type
(`printable-activity`) rendered as inert HTML and excluded from `usedIdevices`, so no iDevice
JavaScript loads for it. The type must not be named after a class the worksheet markup uses:
`IdeviceRenderer` turns it into a class on the wrapper, so `worksheet-activity` put that class on
both the wrapper and the exercise inside it.

*Why not reuse the `text` type as the inert wrapper:* its `renderView` rewrites the component's
content from `jsonProperties` at load, which would erase the fragment.

**File → Print iDevices is gone.** The worksheet is reached from File → Print, as *Print only the
activities*, so the File menu keeps a single entry for printing.

### Folded is not hidden, and print does not confuse the two

Printed from an exported page, a block folded on screen prints its contents. It was collapsed, not
withheld: the text is in the page, and a sheet carrying the heading with nothing under it reads as
an empty block rather than a missing one — which is why nobody notices. The fold is not only the
author's, either. A reader collapses blocks while reading and the state stays, so the same resource
would print differently for two people; and a block whose author turned its toggle off cannot be
opened before printing at all.

The rule lives in `public/style/workarea/base.css`, which is the file every export format ships as
`content/css/base.css` and which the print preview loads too. One rule therefore covers every
format, every theme and all four choices. A style can still be the wrong place for this: putting it
in a theme fixes it for the projects using that theme and leaves the other six alone.

It takes `!important`, which the surrounding rules do not. The toggle collapses with jQuery's
`slideUp()`, leaving `display: none` in a style attribute, and only `!important` beats an inline
style; the author's own fold is a class and would not need it.

**In the preview, folding is the user's choice, and by default the page prints as it is shown.**
*Print all visible content* is clear by default, which puts `exe-print-as-shown` on the preview's
`<html>`: the rule, written as `html:not(.exe-print-as-shown) …`, stands down, the author's folds and
the toggles stay, and the page prints as the preview shows it, so a user can fold what they do not
want on paper and open what they do. Ticking the option takes the class away: the preview shows
folded blocks open and without their toggles, as they will print. Exports never carry the class, so
Ctrl+P on an exported resource always prints folded blocks open. The worksheet has no blocks to fold,
and its panel offers no such option.

**What the author hid stays hidden, and `teacher-only` is deliberately not excluded.** `novisible`
and `teacher-only` sit on the `<article>`, which the existing rules take out of the layout with
`!important` of their own, so nothing inside one is ever laid out whatever this rule says; an
iDevice carrying either class keeps its own rule inside a block that does open. Excluding
`teacher-only` here would have been the easy mistake: in teacher mode that block is meant to
print, folded or not.

Tabs and accordions are the same question and are **not** answered here. Their panels are hidden
by `exe_effects.css` and only the open one prints, so an author's other panels are lost the same
way — but unfolding them also needs a decision about whether each panel's title becomes a heading
for the piece under it, which a block does not need.

## Consequences

### Positive

- The handout is one document, and the teacher decides its shape looking at it, with no second
  window.
- The worksheet renderer gains a second consumer without changing: it already produces per-activity
  fragments.
- Assets need no extra work — `preprocessPages` has already resolved `asset://` to blob URLs before
  the hook point.
- Adding an adapter improves all four choices at once.

### Negative

- For a project with interactive activities, what prints by default has changed: the activities no
  longer print where they are, as the browser draws them, but as exercises in an appendix.
- The preview is drawn again on every change, and a large project makes the user wait each time.
- Four choices to keep working, and each needs E2E coverage.
- The appendix introduces numbering that has to agree between the body's cross-references and the
  back of the document — a correspondence with no compiler to check it.
- By default the handout no longer shows that an activity that can never be printed stood there. A
  teacher who wants it to say so has to tick the option.
- From the preview, a block folded with its toggle turned off prints with its title alone unless
  *Print all visible content* is ticked: there is nothing on it to open.

### Neutral

- This supersedes nothing formally: ADR-01 chose a conversion mechanism, not an integration, and
  the mechanism is unchanged. What changes is that the worksheet stops being a separate output and
  becomes one of the ways the document can be printed.
- The three lists are a judgement about what a teacher considers an activity, and about which
  activities paper can carry, not a technical classification. They will need revisiting as iDevices
  are added.

## Risks

- **The exception lists drift.** Medium likelihood, low severity: a new `html` iDevice that is not
  an activity gets listed in the panel and printed slightly oddly in one choice. Caught by review,
  not by tests.
- **Appendix numbering diverges from the body.** Low likelihood, medium severity — a handout whose
  cross-references point at the wrong exercise is worse than no appendix. Both numbers come from
  one pass over the pages, and an E2E case asserts the correspondence.
- **Redrawing is slow on a large project.** Medium likelihood, low severity. Changes made in quick
  succession are drawn once, and when a slow redraw finishes only the latest pending options are
  drawn, not every one in between.

## Validation

- Unit tests for the four modes over synthetic pages, with no browser.
- E2E for the panel: only the document options when the project has no interactive activity; the
  choices, with the appendix preselected, when it has some; the preview drawn again without closing
  when a choice changes; Print disabled while the preview is being drawn; one case per choice,
  including the appendix cross-reference matching its exercise; and the worksheet reached from the
  preview alone, with no File menu entry of its own.
- E2E for the selection: every activity listed and ticked only while activities are to be printed;
  no printing with none ticked, unless none is to be printed; an unticked activity left out of the
  document and off the worksheet.
- E2E for the activities that can never be printed: no option when the project has none (an empty
  padlock included, which keeps its note); left out of the list, the document and the worksheet's
  note by default; listed and printed with their titles, in place and in the appendix, once the
  option is ticked.
- E2E for folded blocks: the page printed as shown by default; a visible folded block printed open,
  and the hidden ones left folded, once *Print all visible content* is ticked; no such option for
  the worksheet.
- Manual pass over `test/fixtures/todos-los-idevices_dos_informes.elpx`, which contains both
  adapted and unadapted interactive activities.
- Widening the definition is expected to move E2E numbers, and did: a fixture that held one
  convertible activity turned out to hold two unconvertible ones beside it. A case that counts
  activities without saying which kind it means will keep breaking for the right reason and being
  fixed for the wrong one, so they are counted apart.
- Revisit once the feature is in use: if nobody picks "do not print them" or "print only the
  activities", the panel is offering a question that no longer has three answers.

## Follow-up work

- Remember the last choice, if setting it every time proves repetitive in use.
- Tabs and accordions on paper, with a decision about their panel titles.
- A teacher's answer key, still out of scope.

## References

- [ADR-2539-01](ADR-2539-01-generate-printable-content-from-idevice-data.md)
- `src/shared/export/exporters/PrintPreviewExporter.ts` — the document printing path
- `src/shared/export/exporters/printActivityModes.ts` — the four modes, applied to the page model
- `src/shared/export/worksheet/interactiveActivities.ts` — what counts as an activity, and the three
  lists
- `src/shared/export/renderers/PageRenderer.ts` — `renderSinglePage`, the hook point's neighbour
- `src/shared/export/browser/idevice-config-browser.ts` — where `componentType` comes from
- `public/app/workarea/modals/modals/pages/printOptionsPanel.js` — the panel beside the preview
- `public/app/workarea/modals/modals/pages/modalPrintPreview.js` — the preview, its choices and the
  default
