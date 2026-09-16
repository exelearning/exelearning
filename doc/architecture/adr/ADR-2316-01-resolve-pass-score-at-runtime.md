---
id: ADR-2316-01
title: "Minimum score to pass an activity, resolved at runtime"
status: Proposed
date: 2026-09-16
tracking_issue: 2316
deciders:
  - "@mnarvaezm"
reviewers: []
related:
  prs: []
  changes: []
  adrs:
    - ADR-2209-01
    - ADR-2209-02
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-2316-01: Minimum score to pass an activity, resolved at runtime

## Context

Until this change eXeLearning had no shared notion of what "passing" an activity
meant. Three unrelated places decided it, each with its own hand-written number:

- `public/app/common/common.js`, `report.saveEvaluation()` compared the mark
  against a literal `5` on the 0-10 scale every iDevice computes `scorerp` on.
  That single comparison also selected the message the learner reads, because
  `showEvaluationIcon()` derives `msgSuccessfulActivity` /
  `msgUnsuccessfulActivity` from the state it stores.
- The SCORM 1.2 runtime policy used `DEFAULT_SUCCESS_THRESHOLD = 50`, a
  percentage of the page aggregate
  (`public/app/common/scorm/scorm12/exe-scorm12-policy.js:86`).
- The legacy path (SCORM 2004 and packages exported before the SCORM 1.2 runtime
  rewrite) compared the aggregate against a literal `50` in `showFinalScore()`.

Some iDevices had grown their own answer as well. `form` shipped a pass-rate
dropdown **the runtime never read** — it judged everyone at a hardcoded 50 %
while `$form.passRate` stayed `''` for the life of the page. `rubric` grades
internally on its own 0..maximum scale, and was also the one scoring iDevice that
never registered in the progress report at all.

Authors asked for one configurable threshold. What this ADR settles is not
whether to add the option, but **where the value lives once it exists**, and what
shape the code that consumes it takes.

## Problem

An authoring tool writes content once and that content is played many times,
often long after the project was last opened. When a project-wide setting governs
per-activity behaviour, the value can either be **copied into every activity when
it is saved** or **resolved when the activity runs**. The two are
indistinguishable on the day the content is written and diverge permanently
afterwards.

## Decision drivers

- **Authoring intent.** An author who never customises an activity expects it to
  follow the project, including after they change the project.
- **Reach of a correction.** A threshold set wrongly across a 200-page course
  must be fixable in one place, not in 200 activities.
- **Already-published content.** Nothing may change how an existing package
  grades while the feature is present but unused.
- **File-format cost.** Every key added to `<odeProperties>` and to each
  iDevice's stored data is a key the importer, the exporter and every future
  reader must keep honouring.
- **Number of iDevices.** Anything an iDevice has to remember to do is something
  35 of them can get wrong, and that a 36th will not know about.
- **LMS authority.** A teacher configuring an activity inside Moodle is more
  specific than an author configuring content months earlier.

## Options considered

### Option 1: copy the project value into each iDevice on save

The edition form prefills with the project value and stores it in the iDevice's
own data. The runtime reads only what the iDevice carries.

Pros: no new channel between the project and the exported page; the stored value
is self-describing; plainly inspectable in `content.xml`.

Cons: the project option degenerates into a default for *new* activities.
Changing it later leaves every existing one on the old mark, silently and
invisibly — the author cannot tell which activities followed the project and
which were customised, because once stored they are identical.

### Option 2: resolve the project value when the activity runs

An iDevice stores only the author's choice. "Follow the project" stores nothing;
the page publishes the value and the runtime resolves it on load.

Pros: inheritance stays live for the life of the content; one correction reaches
every non-customised activity; "not customised" is representable as the absence
of data, so old content reads correctly without migration.

Cons: needs a channel from the project to the exported page, which did not exist.

### Option 3: resolve at runtime, but let each iDevice re-implement the rule

Pros: maximum per-iDevice freedom; no shared code to agree on.

Cons: 35 copies of one condition, which is exactly how `form` ended up with a
control the runtime ignored.

## Evidence

- The SCORM page aggregate is a weighted mean, not a per-activity verdict:
  `aggregateScore()` computes `sum(normalizedScore * weight) / sum(weights)` in
  `public/app/common/scorm/scorm12/exe-scorm12-activities.js`. A per-activity
  threshold cannot be expressed with the existing page policy.
- `minimumScore` in the activity registry is **not** a threshold:
  `normalizedScore()` computes
  `((score - minimumScore) / (maximumScore - minimumScore)) * 100`, i.e. the lower
  bound of the scale. Setting it to 5 would turn a raw 50 into 47.4, rescaling
  every learner's mark instead of demanding a higher one.
- `form` shipped a pass-mark dropdown the runtime never read: `showScore(50, data)`
  was called with a literal and `$form.passRate` was declared `''` and never
  assigned (`public/files/perm/idevices/base/form/export/form.js`, before this
  change). Evidence that option 3 does not hold over time.
- `interactive-video` carries the same scar in its `weighted` field: it read a
  root-level key nothing ever wrote, so every activity weighed 100 whatever the
  author chose. Evidence that a field an iDevice must remember to list is a field
  it will eventually forget.
- The SCORM 1.2 policy already adopted `cmi.student_data.mastery_score` when the
  LMS publishes one (`resolveSuccessThreshold()`), which is the precedent for
  letting the LMS override content.
- New projects are not seeded with export options: `YjsDocumentManager`
  initialises only title, author, language, licence, theme and dates. Defaults
  are applied by readers, which matches option 2 and not option 1.
- `geogebra-activity` reports through the button alone and fixes `isScorm: 2`
  (`public/files/perm/idevices/base/geogebra-activity/export/geogebra-activity.js`),
  so it has no moment at which to report automatically.
- `rubric` already reports out of ten: `calculateScormScore()` divides the marks
  by the table maximum and multiplies by ten
  (`public/files/perm/idevices/base/rubric/export/rubric.js`). An activity that
  converts to 0-10 to report has no reason to be configured on another scale.
- `rubric` made no call to `gamification.report` at all before this change,
  which is why it never appeared in a learner's progress report.

## Decision

We adopt **option 2**. The ten decisions below are listed in order of
importance: the first five constrain the file format and the behaviour of
already-published content; the rest follow from them and could be revisited
without touching the first five.

### 1. Inheritance is resolved at runtime, not copied on save

An iDevice stores only the author's *choice*: follow the project, or this
specific mark. "Follow the project" **stores nothing**. The page publishes the
project value and the runtime resolves it on load.

Direct consequence: changing the project option moves every non-customised
activity with it, including those saved months ago. And because "not customised"
is the absence of data, all content predating this feature reads correctly **with
no migration at all**.

### 2. The project → page channel is a META tag

No channel existed: `PageRenderer` emitted no global configuration of any kind.
Every exported and previewed page now carries:

```html
<meta name="exe-pass-score" content="5">
```

It travels as a META rather than an inline script for two verifiable reasons:
EPUB forbids inline scripts by CSP, and the parser sees the tag before
`libs/common.js` runs.

### 3. SCORM threshold precedence: LMS > project > historical 50

The SCORM 1.2 policy settles its threshold least specific first: the historical
50, then the mark the page publishes, then `cmi.student_data.mastery_score` if
the LMS publishes one. **The LMS wins on purpose**: `mastery_score` is what the
teacher configured on the activity in their own platform, and that is more
specific than what the author chose when building the content months earlier.

This is a page-level verdict over the weighted aggregate, and is not the same
question as whether one activity was passed — that one is answered per activity,
on the 0-10 scale, and drives the progress report's icon and message.

### 4. The domain is 0-10 with one decimal, and 0 is a legitimate value

The default is 5. A non-numeric value falls back to 5 and **not to 0**, because 0
means "any mark passes" and must stay distinguishable from "not set" — a
`parseFloat(x) || 0` would quietly turn every unset threshold into "everyone
passes". That distinction also forced the correction of a truthiness check
(`if (passRate)`) that hid the verdict when the threshold was 0.

The default of 5 out of 10 is exactly the historical 50 %, and a package with no
META falls back to it: **no existing content changes how it grades**.

### 5. One resolver for every consumer

`$exe.passScore` owns the resolution: `get()` reads the META in an exported page
and the live Y.Doc in the editor; `resolve(data)` answers for one iDevice;
`normalize()` enforces the domain; `toPercent()` converts to the 0-100 scale of
the activity registry. No iDevice repeats the condition.

This works because `common.js` is the same file in both worlds: loaded from
`workarea.njk` in the editor and shipped as `libs/common.js` in the package.

### 6. A single place composes the grading controls

The SCORM tab becomes the **Grading** tab, and `getTab(path, options)` composes
the three blocks that answer the same question — what counts as passing: SCORM,
Progress report and Minimum score. Previously the pass score and the report sat
loose in each iDevice's general options, laid out by hand, so the author had to
look in two places.

Cases that cannot offer something are expressed with composition flags
(`passScore: false`, `hideautosave`) rather than letting each iDevice trim on its
own. The accepted trade-off: any change to that function reaches all 35 tabs at
once.

"Grading" rather than "Evaluation" is deliberate: the iDevice menu already has an
"Assessment and tracking" category, and the tab is narrower than either — no
criteria, no instruments, no rubrics.

### 7. Three persistence conventions coexist, unified nowhere

Three shapes are in use and none needed a migration, precisely because the
absence of data is meaningful (decision 1):

| Shape | Where | How the mark is stored |
|---|---|---|
| Options JSON | most iDevices | `passScoreMode` and `passScoreCustom` in the stored object |
| CSS classes | `geogebra-activity` | `auto-geogebra-pass-score-N`, written only when customised |
| Serialised payload | `interactive-video` | fields on `activityToSave`, which is JSON-stringified |

Unifying them would mean migrating every `.elp` ever saved — large, risky, and
unrelated to the feature that was asked for.

Three iDevices build their options object field by field instead of spreading the
stored data (`geogebra-activity`, `interactive-video`, `rubric`), so in those the
fields must be listed explicitly or they never reach the runtime. This is the
trap the `weighted` bug above fell into.

### 8. Every activity is configured on the same scale, with no exceptions

`rubric` grades internally from 0 to whatever its first level adds up to, so a
mark in its own units was considered — the author reads "Maximum score: 16" on
screen. It was rejected, for two reasons that only became clear once the runtime
was traced.

The rubric **already reports out of ten**: `calculateScormScore()` divides by the
maximum and multiplies by ten before sending. So the learner reads "Your score:
6.25" out of ten while the author would have been configuring out of sixteen —
two scales for the same thing inside one activity.

And on a page with several scoring iDevices, that 6.25 enters the weighted mean
alongside the others. With a threshold in rubric units, the author had no way to
compare what they demanded of the rubric with what they demanded of its
neighbours on the same page.

The same argument closes the general case: an activity that grades on a scale of
its own converts to 0-10 to report, so it can convert to 0-10 to be configured.

### 9. `geogebra-activity` does not offer the automatic mode

Its construction has no end of its own — the learner may keep dragging it
forever — so there is no moment at which to report by itself. Of the three modes,
the one it cannot honour is hidden rather than offering an option that would do
nothing. Its former "Save score button" checkbox encoded exactly the two modes it
can honour, so the radios replace it without losing a capability.

### 10. The threshold decides passing, not completion

`completed` in the activity registry still means *finished*, not *passed*. A
failed activity is still a finished one, and conflating them would leave a
learner who finished but did not pass with a page stuck at `incomplete`.

For the same reason **`minimumScore` was left alone**: despite the name it is the
lower bound of the scale, not a threshold (see Evidence).

## Changes introduced

### Storage and format

- `Y.Map('metadata').passScore`; it travels through ELP/ELPX as
  `<odeProperty>pp_passScore</odeProperty>`.
- `metadata-properties.ts` gains a third property type (`number`) alongside
  `string` and `boolean`, holding the domain, the normalisation and the META name.
- The value is not seeded when a project is created: readers apply the default.

### Path of the value

```
config-params.ts → API /parameters → ProjectProperties → form
                                          ↕ YjsPropertiesBinding
                                Y.Map('metadata').passScore
                                          ↓
                 YjsDocumentAdapter → ExportMetadata.passScore
                                          ↓
              OdeXmlGenerator → <odeProperty>pp_passScore</…>   and
              PageRenderer   → <meta name="exe-pass-score">
                                          ↓
                    ElpxImporter / xml-parser → back into the Y.Map
```

### Interface

- A new `number` field type in the project properties form, with `min`/`max`/`step`
  declared in the property definition.
- The **Grading** tab, with three sections headed alike.
- Four collapsible help notes written from what the runtime does: what each of
  the three SCORM modes implies, and that the weight is a proportion between
  weights rather than a percentage of the total.
- `gamification.help` (`icon`, `note`, `bind`) avoids the sixth copy of the same
  anchor, inline sizing and delegated handler.

### Where the threshold applies

- Progress report and the learner's message: a single comparison in
  `saveEvaluation()`.
- SCORM 1.2: the policy settles the threshold in three layers.
- Legacy SCORM: `showFinalScore()` applies the author's mark.

### Scope

- **35 of 35** scoring iDevices have the shared Grading tab and the shared 0-10
  control. No iDevice opts out.
- `3dmol` and `electrical-circuits` migrate their own progress report to the
  shared block.
- `rubric` gains a progress report, which it never had: it was the one scoring
  iDevice that never registered, so a course mixing rubrics with other
  activities produced a report the rubrics were missing from, and its threshold
  had nowhere to show a verdict. It also gains the four translatable strings
  `showEvaluationIcon` needs, which it lacked.
- Removed along the way: `form`'s dead dropdown, and `getGamificationTab()`,
  which called two helpers that do not exist and which no iDevice ever invoked.

## Consequences

### Positive

- Changing the project option moves every non-customised activity with it, in
  content published years earlier, on the next export.
- One resolver stops an iDevice from ignoring the threshold by oversight.
- The absence of data is meaningful, so none of the three persistence shapes
  needed a migration.
- Three hand-written numbers and one control that did nothing are gone.

### Negative

- Exported pages now depend on a META tag. A consumer that stripped unknown META
  elements would silently fall back to 5 rather than failing.
- A saved iDevice is no longer self-describing: reading its stored data does not
  tell you the mark it will be judged by.
- Any change to `getTab` reaches all 35 tabs at once.

### Neutral

- The domain and the normalisation exist in
  `src/shared/export/metadata-properties.ts` and again in
  `public/app/common/common.js`, because the runtime cannot import TypeScript.
- `geogebra-activity` stores the threshold through its own convention (CSS
  classes) but publishes the same two fields to the shared resolver, so the
  difference stops at the storage layer.

## Risks

- **Divergence between the two copies of the rule** (TypeScript and JavaScript).
  Both are covered by tests and name each other in comments, but they can drift.
- **A stale META in a cached page.** Low: it is regenerated on every export and
  preview.
- **Authors reading "Weighted" as a share of the page.** Mitigated with a help
  note, not with code.
- **Top-level declarations in an edition file.** The editor re-injects those
  files with a `<script>` tag on every open, so a module-level `const` breaks the
  second edition with "Identifier has already been declared". It happened during
  this work; a test now pins the rule.

## Validation

- Unit tests cover the domain and the normalisation on both sides of the language
  boundary, the adapter, the five exporters, the importer, the XML parser, the
  policy precedence and the per-activity verdict.
- `test/e2e/playwright/specs/project-pass-score.spec.ts` walks the whole path:
  the field in project properties, the value in the Y.Doc, the META in the
  previewed page and `$exe.passScore.get()` inside the iframe.
- The claim that nothing changes for existing content is pinned by a test
  asserting that a page publishing no threshold keeps `DEFAULT_SUCCESS_THRESHOLD`.
- For `map`, whose six game modes each end differently, a test asserts that all
  of them still report through a single `saveEvaluation` funnel — the property
  that lets the threshold reach every mode without touching the runtime.

## Follow-up work

- Verify in a real Moodle that a project mark is overridden by an activity-level
  `mastery_score`, asserted at unit level only so far.

## References

- `public/app/common/common.js` — `$exe.passScore`, `report.saveEvaluation()`
- `public/app/common/common_edition.js` — the Grading tab, `gamification.help`
- `public/app/common/scorm/scorm12/exe-scorm12-activities.js` — `aggregateScore()`
- `public/app/common/scorm/scorm12/exe-scorm12-policy.js` — `resolveSuccessThreshold()`
- `src/shared/export/metadata-properties.ts` — domain, normalisation, META name
- `src/shared/export/renderers/PageRenderer.ts` — where the META is emitted
- `doc/elpx-format/metadata.md` — the `pp_passScore` property
- [ADR-2209-01](ADR-2209-01-scorm12-runtime-rewrite.md) — the SCORM 1.2 runtime
- [ADR-2209-02](ADR-2209-02-scorm12-activity-completion-registry.md) — its activity registry
