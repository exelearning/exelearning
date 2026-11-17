---
tracking_issue: 2769
title: "iDevice refactoring test — tasks"
date: 2026-11-17
authors:
  - "@ignaciogros"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# iDevice refactoring test — tasks

Development plan for branch `feature/idevice-refactoring-test`. Starting choices (not final) are in [design.md](design.md) and
findings in [research.md](research.md). Update this file as work lands.

## Next steps

1. Choose a starting approach for how the export registers the score: wrap the existing shared SCORM code with types, or rewrite it in
   the kit's `runtime` part. Review that code first.
2. Confirm the rendering approach (R3): export components emit escaped HTML strings for `renderView`;
   editor components build DOM.
3. Define the `form-builder` data model v1 in detail (see open questions).
4. Write the contract types and the bridge to `IdeviceNode`.

## Open questions

- **Score registration** in the export: reuse or rewrite (next step 1).
- **Data model details**: how the correct option is represented (flag per option or id of the correct option),
  ids of questions and options, where question-level feedback and hint live, default values.
- **Section data**: shape of Grading and Custom texts; how custom texts get their `c_()` defaults.
- **Registration lists (R4)**: add `form-builder` to the hard-coded lists, or derive them from `config.xml`.
- **Generic build script**: name, inputs and outputs; replaces per-iDevice scripts such as Slide's.
- **Instance isolation**: ids and state for several instances on one page.
- **Style guide page**: location and format (components phase).

## Plan

### Phase 0 — Groundwork

- [x] Starting choices for the pilot, data scope, sections, location and type checking (design D1–D8).
- [x] Record findings (research R1–R9).
- [ ] Report R7 (2.9 Multichoice import data loss) as a separate issue.
- [ ] Wait for ateeducacion/exelearning#42 in `main`, then rebase the branch.

### Phase 1 — Contract

- [ ] Edition and runtime interfaces (`mount`, `getData`, `validate`, `destroy`; runtime render, behaviour,
      init).
- [ ] Versioned data envelope and upgrade mechanism.
- [ ] Section contract (typed data, editor, runtime behaviour) and default layout.
- [ ] Bridge to the classic `IdeviceNode` lifecycle and `this.$lifecycle`.
- [ ] Unit tests for the contract and the bridge.

### Phase 2 — Shared sections

- [ ] Instructions.
- [ ] Grading (including score registration in the export).
- [ ] Custom texts.
- [ ] Tests: data round-trip, validation, defaults.

### Phase 3 — Shared components

- [ ] Editor part: tabs, buttons, labelled fields, feedback messages, list editor (add, delete, reorder).
- [ ] Runtime part: buttons, feedback messages, question rendering.
- [ ] Check that the export bundle imports nothing outside `runtime`.
- [ ] Accessibility and localization.

### Phase 4 — `form-builder` iDevice

- [ ] Data model v1 and single-choice question type.
- [ ] Edition (Questions and Behaviour options sections plus the shared ones).
- [ ] Export: render, behaviour, feedback, score.
- [ ] Generic build script; bundles in `public/files/perm/idevices/base/form-builder/`.
- [ ] Registration (`config.xml`, exporter lists or their replacement).
- [ ] E2E: create → edit → save → reload → preview → export; static build.

### Phase 5 — Visual design and style guide

- [ ] Apply the component designs (provided separately by the user, used only from this phase).
- [ ] Style guide page with live examples.

### Phase 6 — Evaluation

- [ ] Developer effort compared with a classic iDevice.
- [ ] Bundle size and runtime constraints of the export.
- [ ] What the contract and components could not cover.
- [ ] Recommendation (adopt, adjust or discard) and possible migration order.
- [ ] Set the design status to `implemented` or `abandoned`; write an ADR only if adopted.

## Progress

- 2026-11-17: issue #2769 opened, branch created, starting choices D1–D8 recorded.

## References

- Issue [#2769](https://github.com/exelearning/exelearning/issues/2769).
- [ateeducacion/exelearning#42](https://github.com/ateeducacion/exelearning/pull/42) (type checking).
- #2700 (iDevice edition refactor; input only).
