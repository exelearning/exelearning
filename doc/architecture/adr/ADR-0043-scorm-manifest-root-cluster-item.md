---
id: ADR-0043
title: "Wrap every exported page in a root cluster item in SCORM/IMS manifests"
status: Proposed
date: 2026-08-06
deciders:
  - "@mnarvaezm"
reviewers:
  - "@erseco"
related:
  issues:
    - "#2222"
  prs: []
  sdds: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-0043: Wrap every exported page in a root cluster item in SCORM/IMS manifests

## Status

Proposed

## Context

eXeLearning 4 models the project outline as a **forest**: `Home`, `Topic 1`,
`Topic 2`… are all root pages with an empty `parentId`, as stored in the Yjs
navigation array and serialised to `content.xml` as
`<odeParentPageId></odeParentPageId>`. eXeLearning 2.x modelled it as a **tree**
with one root node, so every other page had a parent.

The manifest generators mirrored the document model literally: root pages became
sibling top-level `<item>` elements of the `<organization>`. That is valid IMS
Content Packaging, but issue #2222 reports that with the **stock Moodle SCORM
activity** (`mod_scorm`) the bottom navigation buttons stop working for
top-level pages: from "Topic 1" it is impossible to reach "Topic 2" with
`#nav_skipnext`. Packages produced by eXeLearning 2.9 do not have the problem,
and neither does the eXeLearning-maintained `mod_exescorm` plugin.

## Problem

Should the exported manifest keep reproducing the forest shape of the document
model, or should it be reshaped so that stock `mod_scorm` can navigate it?

## Decision drivers

- Sibling navigation must work in **unmodified Moodle**, not only in
  `mod_exescorm`; most users install the standard SCORM activity.
- The hierarchy authored by the user must stay recognisable in every LMS: a page
  the author placed at the top level should not silently become a child of
  another page.
- The three manifest generators (SCORM 1.2, SCORM 2004, IMS CP) must stay in
  sync; the item-tree code was triplicated.
- The manifest must remain valid IMS CP / SCORM.

## Options considered

### Option 1: Wrap every page in one non-launchable root cluster item

Emit a single `<item>` with no `identifierref`, titled with the project title,
containing all pages. Root pages become children of that cluster and therefore
siblings of one another in the LMS's model.

- Pro: restores `#nav_skipnext` / `#nav_skipprev` / `#nav_up` at every level in
  stock `mod_scorm`.
- Pro: the authored hierarchy is preserved — `Home` stays a sibling of `Topic 1`.
- Pro: a cluster item without `identifierref` is the canonical SCORM 2004 shape
  for an aggregation node.
- Con: Moodle's table of contents gains one root node showing the project title,
  which the TOC panel header already displays.

### Option 2: Nest top-level pages under the first page's item

Reproduce the eXeLearning 2.9 shape exactly: `Topic 1`, `Topic 2`… become
children of the `Home` item.

- Pro: byte-for-byte parity with 2.9; no extra node in the TOC.
- Con: misrepresents the document model. In every LMS and in the IMS CP export,
  pages the author placed at the top level would appear indented under `Home`.
- Con: in SCORM 2004 the wrapping item both references a resource and has
  children, which the CAM discourages.

### Option 3: No change; treat it as a Moodle defect

Report the defect upstream and rely on `mod_exescorm`, which already patches its
copy of `module.js`.

- Pro: no change to the exporters; the manifest is already spec-valid.
- Con: every user on the standard SCORM activity stays broken, with no
  workaround under their control.

## Evidence

Both packages attached to #2222 were extracted and compared against the real
`mod_scorm` sources (`MOODLE_405_STABLE`). The failure chain is:

1. `datamodels/scormlib.php` gives top-level `<item>` elements
   `parent = <organization identifier>` and nested ones
   `parent = <parent item identifier>`.
2. `player.php` (`$adlnav = scorm_get_adlnav_json($scoes['scoes']);`) rebuilds
   the SCO tree via `scorm_get_toc_object()` **without** passing
   `$organizationsco`, unlike the call that renders the table of contents.
3. Without that anchor, `scorm_get_toc_get_parent_child()` in `locallib.php`
   cannot attach the 2nd..Nth top-level item to anything: it increments
   `$level` for each and returns several disconnected trees whose roots receive
   no `parentscoid`.
4. `scorm_get_adlnav_json()` only links `prevsibling` / `nextsibling` between
   SCOs that are adjacent in depth-first order **and** share a `parent`, so an
   item that has children never gets a `nextsibling`. This affects 2.9 and 4
   equally.
5. `scorm_update_siblings()` in `module.js` repairs (4) by grouping SCOs that
   share a `parentscoid` — which the roots produced in (3) do not have.
6. `scorm_skipnext()` then fails both of its branches (no `nextsibling`, and
   `node.parent.parent` is undefined for a tree root) and returns `null`, so
   `scorm_fixnav()` disables `#nav_skipnext`.

Replaying steps 3–6 over the two attached manifests reproduces the report
exactly: with the 2.9 package `#nav_skipnext` on "Topic 1" leads to "Topic 2";
with the 4.0.2 package it is disabled. Replaying them over a manifest generated
with the root cluster item restores it, and additionally fixes sibling jumps
between pages that have sub-pages (`Section 1.1` → `Section 1.2`), which were
broken in 2.9 too.

`mod_exescorm` fixed the same failure on the LMS side by bucketing parentless
SCOs under a sentinel key in its own `exescorm_update_siblings()`, which is why
the reporter sees correct behaviour there.

## Decision

We will emit a single non-launchable root cluster `<item>` in the SCORM 1.2,
SCORM 2004 and IMS CP manifests (Option 1). Its identifier is
`ITEM-ROOT-<projectId>`, stable across re-exports like the manifest identifier
(#1785), and its title is the project title. The item-tree builder lives in
`src/shared/export/generators/ManifestItems.ts` and is shared by the three
generators, replacing three identical copies of `generateItems()`.

## Consequences

### Positive

- `#nav_skipnext`, `#nav_skipprev` and `#nav_up` work at every level in stock
  `mod_scorm`, including between pages that have sub-pages.
- The authored hierarchy is preserved in every consumer.
- SCORM 2004 aggregation nodes now include a proper cluster at the root, and
  every cluster keeps its `<imsss:sequencing>` block.
- One item-tree implementation instead of three.

### Negative

- Moodle's table of contents shows an extra root node with the project title,
  duplicating the TOC panel header.
- Manifests differ from those of previous 4.x releases; an LMS that tracked the
  old top-level items will see them one level deeper.

### Neutral

- The root item is not launchable, so LMSs render it as plain text rather than a
  link. That is standard SCORM cluster behaviour.
- Empty projects still emit no items at all; the cluster is only added when
  there is at least one page.

## Risks

- Low: an LMS that requires the first item of an organization to be launchable
  would show an unselectable root. No such LMS is known among the targets
  (Moodle, Blackboard, Canvas, Sakai), and clusters are part of the SCORM CAM.

## Validation

- `src/shared/export/generators/ManifestItems.spec.ts` asserts the root cluster
  shape, sibling preservation, cluster hooks and degenerate inputs.
- The SCORM 1.2, SCORM 2004 and IMS CP generator specs assert the root item is
  present and non-launchable.
- `test/e2e/playwright/specs/scorm-manifest-navigation.spec.ts` exports a
  project with nested pages to all three formats and validates the manifest
  tree.
- Manual: upload the exported package to a Moodle course using the **standard**
  SCORM activity and confirm `#nav_skipnext` moves from "Topic 1" to "Topic 2".

## Follow-up work

- Report the `mod_scorm` defect upstream: `player.php` builds the navigation
  JSON without `$organizationsco`, so `scorm_get_toc_get_parent_child()` cannot
  anchor top-level items to the organization.
- Separate issue for SCORM 2004 conformance: an `<item>` that has children
  should not carry `identifierref`. eXeLearning 2.9 inserted a "fake node" for
  this in `scormexport.py`; the current generator does not.
- Separate issue for adding `xmlns:xsi` and `xsi:schemaLocation` to the
  manifests, which 2.9 emitted and 4.x does not.

## References

- Issue [#2222](https://github.com/exelearning/exelearning/issues/2222) —
  Navigation issues in SCORM with nested pages
- `mod_exescorm` issue #63 — the equivalent fix on the LMS side
- Moodle `mod/scorm/locallib.php`, `mod/scorm/datamodels/scormlib.php`,
  `mod/scorm/player.php`, `mod/scorm/module.js` (`MOODLE_405_STABLE`)
- `src/shared/export/generators/ManifestItems.ts`
- Issue #1785 — stable SCORM manifest identifiers across re-uploads
