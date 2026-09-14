---
id: ADR-2415-01
title: "Separate the publication and storage contracts for the editable source"
status: Proposed
date: 2026-09-14
tracking_issue: 2415
deciders:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs: []
ai_assistance:
  tool: Claude Code
  model: Opus 5
---

# ADR-2415-01: Separate the publication and storage contracts for the editable source

## Context and problem

The project property `exportSource` ("Editable export", `src/routes/config-params.ts:310`)
is documented as controlling whether an export ships the re-editable ODE source,
`content.xml`. At commit `1e2dc4d9f` only `Html5Exporter`, `Epub3Exporter` and
`PageExporter` read it; `Scorm12Exporter`, `Scorm2004Exporter` and `ImsExporter`
wrote `content.xml` and `content.dtd` unconditionally
([#2415](https://github.com/exelearning/exelearning/issues/2415)).

Removing the property altogether was proposed in
[#2028](https://github.com/exelearning/exelearning/issues/2028) and closed as
*not planned*: eXeLearning carries content under licences that do not permit
modification (CC BY-NC-ND, all rights reserved), so publishing without the
editable source is a legitimate use case. The property stays, and the three
package formats must stop ignoring it.

Honouring it, however, breaks a second, unrelated contract. Moodle
`mod_exescorm` stores the SCORM 1.2 package **as the project**: its embedded
editor exports `scorm12` on save (`editor/bridge.js:279`) and re-opens that same
stored package on the next edit (`editor/bridge.js:223`, `OPEN_FILE`). Its upload
validation also required, at the time of writing, a root `content(v\d+)?\.xml` by
default (`settings.php:164`, `classes/exescorm_package.php:95`) — applied to every
package, whether it was going to be edited or merely played. An author who turns
the property off would have their save rejected outright, and if it were accepted
the activity could never be edited again.

Two different things are being asked of one file, and they pull in opposite
directions.

## Decision

Treat them as separate contracts, and let the consumer rule follow from the split.

1. **Publication.** SCORM 1.2, SCORM 2004, IMS, website and ePub are artefacts
   handed to a learner or an LMS. Whether they carry the editable source is the
   author's decision, expressed by `exportSource`, and all of them now honour it.
   A single `BaseExporter.shipsEditableSource()` answers the question once, so
   the formats cannot drift apart again.

2. **Storage.** A host that keeps the exported package as the project's only
   copy and re-opens it for editing is not publishing — it is saving. Such a host
   declares that by passing `forceEditableSource: true` in the `REQUEST_EXPORT`
   options of the embedding bridge, and always receives the source. The author's
   property still governs every export the author themself triggers.

3. **Consumption.** The corollary binds consumers: a package that carries no
   eXeLearning source is still a valid package. A consumer may require the source
   where it is genuinely about to edit it, and must not require it merely to
   accept or play a package. Those are different moments and they need different
   checks, even inside one plugin.

`.elpx` is outside all three: `content.xml` is mandatory in that format, so a
valid `.elpx` always carries the project. Hosts that export `elpx` — `mod_exeweb`
(`amd/src/editor_modal.js:25`) and `mod_exelearning`
(`amd/src/editor_modal.js:49`) — need no flag and are unaffected.

## Alternatives and consequences

**Always include `content.xml` in packages** is [#2028](https://github.com/exelearning/exelearning/issues/2028),
already rejected: it removes a supported licensing workflow.

**Relax `mod_exescorm`'s mandatory-file rule outright** — dropping it everywhere —
would let the editor save a source-less package and turn a clear failure into
silent data loss on the next edit. What that plugin needed was not a weaker rule
but the rule moved to the right moment, which is point 3 above: its upload
validation no longer demands a source, because an uploaded package is played and
never edited; its `set_ode.php` save path and its editor entry point now demand
one explicitly, because those are the moments the source is about to be needed.
The rule had been gatekeeping rather than validating — nothing in that plugin
reads `content.xml` at runtime, and SCORM validity was already enforced
separately by a root `imsmanifest.xml` check. `mod_exeweb` keeps its equivalent
rule, because it offers the embedded editor for every activity with no type gate,
so there every uploaded package really is a candidate for editing.

**Store the `.elpx` beside the published package in `mod_exescorm`** is the
better long-term shape and is what a publishing-oriented activity should do: the
author's choice would then apply to the served package while the source stays
private to the plugin. It needs a new file area plus backup, restore and upgrade
paths, so it is deliberately left as follow-up work rather than a precondition
for fixing #2415.

Consequences: a SCORM or IMS package exported with the property off is no longer
re-importable, which is the point, and is already true of the website and ePub
exports. `mod_exescorm` keeps exactly the behaviour it had before this change for
editor-driven activities — its stored package always carries the source — so
nothing it serves today becomes more or less exposed, while a package uploaded to
it is no longer rejected for carrying no source. Hosts that ignore the flag and
store a publication package as their project inherit the defect the flag exists
to prevent; the embedding documentation says so explicitly.

## Validation

Colocated specs assert both directions for all three package formats
(`src/shared/export/exporters/{Scorm12,Scorm2004,Ims}Exporter.spec.ts`): the
source is present by default, absent when the property is off — with the
manifest never referencing a file that is not in the archive — and present again
when a host forces it. `public/app/core/EmbeddingBridge.test.js` covers the
option reaching the exporter. `test/e2e/playwright/specs/export-source-property.spec.ts`
exercises the production browser path end to end and fails against the
pre-change exporters.

## References

- [Issue #2415](https://github.com/exelearning/exelearning/issues/2415)
- [Issue #2028](https://github.com/exelearning/exelearning/issues/2028) (rejected removal proposal)
- `doc/elpx-format/metadata.md:129` — the `exportSource` property
- `doc/development/embedding.md` — `REQUEST_EXPORT` and `options.forceEditableSource`
- [exelearning/mod_exescorm#96](https://github.com/exelearning/mod_exescorm/pull/96) —
  the consumer side: play a source-less package, demand the source only when editing
