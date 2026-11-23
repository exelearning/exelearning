---
id: ADR-2700-01
title: "Deprecate $exeDevicesEdition and remove it in v4.0.8"
status: Proposed
date: 2026-11-18
tracking_issue: 2700
deciders:
  - "@mnarvaezm"
reviewers:
  - "@erseco"
related:
  prs: [2700, 2147]
  changes: []
  adrs:
    - ADR-2293-01
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5.5"
---

# ADR-2700-01: Deprecate $exeDevicesEdition and remove it in v4.0.8

## Context

An iDevice builds its edition form with a shared library. On `main` that library is
`$exeDevicesEdition`, defined in `public/app/common/common_edition.js`. PR #2700 adds
`$exeIDevicesEdition` in `public/app/common/common_idevices_edition.js` and moves the 38
iDevices in `public/files/perm/idevices/base/` to it. New code and fixes go to the new library.

The old file is still loaded in every edition (`views/workarea/workarea.njk`,
`scripts/static-bundle/static-index.html`, `scripts/static-bundle/minify-dist.ts`), for two kinds
of iDevice:

- The new interactive video of PR #2147, still in review, which uses its `scorm.getTab`,
  `getLanguageTab`, `tabs.init` and `getIdeviceDescription`.
- iDevices that users install. They may call any part of the old library, and they will have to
  move to the new one.

On `main`, nothing told the authors of those iDevices that the old library would go. Removing it
would break them without notice (review of PR #2700 on 2026-11-17).

## Problem

How do the authors of iDevices that still use `$exeDevicesEdition` learn, before it goes, that it
goes, when it goes, and what replaces it?

## Decision drivers

- An installed iDevice must not stop working without notice.
- One library to fix: a fix made in two copies is a fix that can be missed in one.
- No warning and no cost when no iDevice uses the old library.
- A removal that can be checked: a version, not "once nothing uses it".

## Options considered

### Option 1: remove the file in this PR

Pros: a single library at once.

Cons: it breaks #2147 and any installed iDevice that uses it, with no notice.

### Option 2: keep it indefinitely, or as an adapter over the new library

Pros: no installed iDevice ever breaks.

Cons: the new library has no `scorm.getTab`, `getLanguageTab` or `tabs.init`, because its forms are
built by `tabs.getHtml`. An adapter would keep the old interface alive on top of the new one, and
every change to the new library would have to keep it working.

### Option 3: deprecate it now and remove it in a fixed version

Pros: the old library keeps working, and its users learn when it goes and what replaces it. After
the removal, there is one library.

Cons: an iDevice whose author does not update it in time stops working.

## Evidence

- On this branch no iDevice in `public/files/perm/idevices/base/` refers to `$exeDevicesEdition`
  (`git grep '\$exeDevicesEdition' -- public/files/perm/idevices/base` finds nothing). In the
  application, only `IdeviceNode.save()` refers to it
  (`public/app/workarea/project/idevices/content/ideviceNode.js`).
- `IdeviceNode.save()` calls `gamification.helpers.stopSound()` on both objects on every save,
  whether an iDevice uses the old library or not. A warning on any use would therefore appear with
  no iDevice using it.
- Releases come out about once a month: v4.0.0 on 2026-04-30, v4.0.1 on 2026-06-09, v4.0.2 on
  2026-07-07, v4.0.3 on 2026-08-06, v4.0.5 on 2026-09-16 and v4.0.6 on 2026-10-29 (git tags). This PR
  would ship in v4.0.7.

## Decision

We adopt **option 3**.

- `common_edition.js` keeps loading until v4.0.8 and is removed in that release.
- The first call an iDevice makes to a function of `$exeDevicesEdition` on a page writes one console
  warning:
  `$exeDevicesEdition (common_edition.js) is deprecated and will be removed in eXeLearning v4.0.8. Use $exeIDevicesEdition (common_idevices_edition.js) instead.`
  The call to `gamification.helpers.stopSound()` that the application makes on every save does not
  count. The warning goes to the console, not to an alert, because the iDevice's developer can act
  on it and the content author cannot.
- Before v4.0.8, #2147 moves to `$exeIDevicesEdition`, and the authors of installed iDevices move
  theirs.

## Consequences

### Positive

- An iDevice that still uses the old library keeps working. Its developer is told in the console
  when it goes and what replaces it.
- After v4.0.8, fixes go to one library only.
- Nothing changes for the iDevices in `base/`, which no longer use it.

### Negative

- About a month of notice, from v4.0.7 to v4.0.8, is short for an iDevice that is rarely updated.
  Such an iDevice stops working in v4.0.8.
- The warning only reaches someone who opens the console.

### Neutral

- Every edition still loads the old file until v4.0.8.

## Risks

- #2147 is not on the new library by v4.0.8. Then either #2147 is adapted first or the removal
  waits for it. The team decides which; the removal does not ship with an iDevice that needs the
  file.
- Developers of installed iDevices miss the console warning. The v4.0.7 release notes announce the
  deprecation, under "Deprecated", with the version.

## Validation

- `public/app/common/common_edition.test.js`, "common_edition.js deprecation", checks four things:
  loading the file says nothing; the first call says it once, with the version and the replacement;
  `stopSound()` does not count; each function keeps the object it is called on and its result.
- At v4.0.8, `git grep '\$exeDevicesEdition'` finds nothing outside the release notes.

## Follow-up work

- Announce the deprecation in the v4.0.7 release notes (`public/CHANGELOG.md`).
- Move #2147 to `$exeIDevicesEdition`.
- In v4.0.8, remove:
  - `common_edition.js`, `common_edition.test.js` and `common_edition.electron.test.js`;
  - the loads in `views/workarea/workarea.njk`, `scripts/static-bundle/static-index.html` and
    `scripts/static-bundle/minify-dist.ts`, and the line about it in `minify-dist.spec.ts`;
  - the `$exeDevicesEdition` stand-in in `public/vitest.setup.js`;
  - the old object in the sound loop of `IdeviceNode.save()`, with its tests in
    `ideviceNode.test.js`.

## References

- PR #2700: the new edition library and the review that asked for this path (2026-11-17).
- PR #2147: the new interactive video, the last iDevice of this repository on the old library.
- [ADR-2293-01](ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md): the
  edition lifecycle that both libraries use.
