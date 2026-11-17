---
tracking_issue: 2769
title: "iDevice refactoring test — design"
status: draft
date: 2026-11-17
authors:
  - "@ignaciogros"
reviewers: []
implementation_prs: []
related_adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# iDevice refactoring test — design

Working design for the pilot described in [#2769](https://github.com/exelearning/exelearning/issues/2769):
an example iDevice written in TypeScript (edition and export) that defines the iDevice contract, the first
shared sections and components, and the evidence needed to adopt, adjust or discard the approach.

This document records the starting choices made so far and why. None of them is final: the tests in this
branch are what will confirm, adjust or discard them. Findings that support them are in
[research.md](research.md); the development plan and the open questions are in [tasks.md](tasks.md).

## Working method

- **Bottom-up**: contract and data first, then shared sections and components, then visual design.
  Decoration comes later and in small steps, but is not neglected.
- **No reference model.** Existing iDevices and open pull requests (including #2700) are inputs to evaluate,
  not targets to reproduce. Each choice states the need it answers.
- Choices are made one at a time and recorded here before code depends on them, and are revisited whenever
  the tests show a better option.

## Starting choices

### D1. The pilot is a question builder with one question type

- iDevice id `form-builder`, title "Form builder".
- It contains a list of questions. Version 1 supports one question type: **single choice**.
- **Why:** the most reusable unit across iDevices is the *question type* (single choice, true/false, fill in
  the blanks, dropdown…), currently reimplemented by `form`, `quick-questions`, `trueorfalse`,
  `adaptative-quiz` and others. A standalone single-choice iDevice would not exercise that second contract
  level, nor composition (an iDevice made of typed parts), and would duplicate `form` for users.
- `form` cannot be reused as is (inline HTML, 3,351 + 2,004 lines). Its data can be converted later; ids do
  not need to match.

### D2. Single-choice data model: superset of 2.9 Multichoice and `form`

- Optional feedback per option (as in eXeLearning 2.9 `MultichoiceIdevice`).
- Optional question-level feedback for right and wrong answers (as in `form`), shown when the chosen option
  has no feedback of its own.
- Optional hint (`hint` in 2.9, `suggestion` in `form`).
- Option text is **plain text** in version 1.
- **Why:** converting from either source must lose nothing. Plain text is the smallest safe start and matches
  what the 2.9 import already produces.

### D3. Stored data is versioned and upgraded on load

- Every stored payload carries a version. Upgrade functions turn older versions into the current one when a
  project is opened.
- **Why:** the model must be able to grow (for example plain text → HTML options, which is lossless) without
  breaking saved projects. Going from rich to plain text would be lossy, so growth goes from simple to rich.

### D4. Sections are the shared unit; tabs are a default layout

- A **section** is the shared unit: typed data, its editor and its behaviour in the export.
- A default layout says which tab holds each section and in which order. An iDevice uses it unless it
  overrides it, and may add its own tabs.
- Not every iDevice uses every shared section; some may use none.
- **Why:** it separates what a section does (contract and data, testable) from where it is shown
  (presentation). The default layout keeps iDevices consistent without forcing any of them.

### D5. Sections of the pilot

| Section | Kind | Contents |
| --- | --- | --- |
| Instructions | shared | Rich text read by the learner before starting |
| Grading | shared | Whether and how the score is saved (SCORM), weight, pass mark |
| Custom texts | shared, optional | Learner-facing labels such as "Check", "Correct", "Incorrect", "Try again" |
| Questions | own | Question list: add, delete, reorder; each question typed (single choice only) |
| Behaviour options | own | Shuffle questions and options, when to show feedback (per question or at the end), retry |

Out of this test: access codes, score-percentage messages, and importing, exporting or generating questions
with AI. The section model must admit them later without changing the contract.

The three shared sections cover distinct cases: one with a rich-text editor, one with logic in the export
(the score) and one that only some iDevices use.

### D6. Code location

- Shared kit: `src/shared/idevice/`.
- iDevice source: `src/idevices/form-builder/`.
- The build writes the bundles to `public/files/perm/idevices/base/form-builder/`, next to its `config.xml`
  and CSS.
- **Why:** the new code gets the same gates as the rest of the TypeScript (Biome check and format, Bun tests,
  90% coverage), and import/export code in `src/shared/` can use the iDevice data types, so a converter from
  2.9 or `form` is checked by the compiler.
- Moving the source into the iDevice folder later is possible and cheap: stored data does not depend on it.
  It would need a `biome.json` include limited to `*/src/**/*.ts`, a test runner for `public/**` (Vitest, 80%
  threshold) or a Bun exception, and new build and import paths.

### D7. Type checking

- Relies on [ateeducacion/exelearning#42](https://github.com/ateeducacion/exelearning/pull/42), expected in
  `main` soon: strict `tsconfig.json` and `make typecheck` (`tsc --noEmit`) inside `make fix` and `make lint`.
  With no `include` list, every `.ts` in the repository is checked; `*.spec.ts` files are not.
- No separate `tsconfig` for this test.

### D8. Visibility

- No hiding: this is a development branch seen only by developers.

## From the issue (accepted scope)

- Typed interfaces for the edition (`mount`, `getData`, `validate`, `destroy`) and for the export runtime.
- A standard bridge to the current `IdeviceNode` lifecycle (`init`, `save`, `this.$lifecycle`), so classic
  and new iDevices coexist.
- Shared components split into an editor-only part and a `runtime` part safe for exported content; a check
  ensures the export bundle imports nothing outside `runtime`.
- One generic build script producing standalone IIFE bundles for edition and export; export output readable
  (not minified) and committed.
- Works in preview, HTML5 export, SCORM, ePub and static build, with several instances on one page.
- Accessibility (labels, keyboard, focus, announced feedback) and localization (`_()` editor, `c_()` content).

## ADRs required or referenced

None yet. An ADR is needed only if the contract is adopted beyond this test.
