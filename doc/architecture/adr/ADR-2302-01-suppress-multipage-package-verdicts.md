---
id: ADR-2302-01
title: "Suppress page-local package verdicts on multipage exports"
status: Proposed
date: 2026-08-19
tracking_issue: 2302
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: [2302]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Codex, Claude Code"
  model: "GPT-5.6-sol, claude-opus-5"
---

# ADR-2302-01: Suppress page-local package verdicts on multipage exports

## Context

Each page of a multipage web export is a separate HTML document with a fresh JavaScript context. The
xAPI emitter's per-page state (`_state`) therefore only ever holds the scores answered on the current
page, yet the emitter computed a package-level `completed` + `passed`/`failed` pair from it on every
answer, against the package's Activity IRI. Two pages of one attempt could emit a `passed` (raw 100)
and a `failed` (raw 40) for the same activity — a self-contradicting record for any consumer.

A second defect shared the root cause on single-page packages: the aggregate normalized over the
*answered* subset only, so a learner who answered just the weight-25 iDevice of a 25/75 package was
reported as `passed` with raw 100.

## Problem

What should the emitter report at package level, given that no page of a static multipage export can
ever know the whole attempt?

## Decision

1. **Multipage packages emit no package-level verdict at all.** The exporters inject `pageCount`;
   when it exceeds 1 the emitter skips `completed`/`passed`/`failed` entirely. A wrong verdict is
   worse than no verdict: consumers that need a package result derive it from the per-iDevice
   `answered` statements and their own knowledge of the package.
2. **Gradable iDevices seed the page aggregate at score 0 as they register** (`registerEvaluable`,
   forwarded from `registerActivity` in every export format that ships the emitter), carrying their
   real weight. This fixes the single-page partial-attempt inflation: the verdict a single-page
   package still emits now normalizes over every gradable iDevice of the page, answered or not.
   The seeding is internal emitter state; nothing about unanswered iDevices is emitted.
3. **Statement hygiene for any LRS:** the answered score is clamped onto its declared 0..10 scale;
   the LRS POST uses `keepalive` so the pagehide-time `terminated` survives document unload; the
   terminate hook binds `pagehide` only (an `unload` listener would be a duplicate and disables the
   back/forward cache); statements carry the page identity (`page-id`, `page-title`, `page-count`)
   injected by the exporter, since the runtime tracker never supplies it.

The emitter ships with the base libraries of **every** export format, as an analytics/external-LRS
channel: grading authority stays with each format's own runtime (SCORM's `cmi.*`) or with the
consumer's server. Every format injects the identity config (`odeId`, `pageCount`, page identity), and
the loader `<script>` tag is only emitted alongside that config — a format that passed no config used
to load an emitter that fell back to per-page document URLs and no `package-id` (garbage identity),
and the print preview requested a file its exporter never copies.

## Alternatives considered and rejected

### A weight/order/census reconstruction contract (built, then reverted)

An earlier revision of this PR emitted `idevice-weight` and `idevice-order` on `answered` statements
plus an `idevice-census` of every gradable iDevice on the lifecycle statements, so a consumer could
reconstruct an exact weighted package total for partial multipage attempts. It was fully built and
tested — and then reverted after an architectural necessity review established that:

- **PERITEM is the default grading model of the only consumer** (`mod_exelearning`): one Moodle grade
  item per gradable iDevice, graded from `objectid` + score alone. No weight, order or census
  participates in any published per-item grade, on either of the plugin's channels.
- **"Exact partial OVERALL" is not a documented requirement anywhere** — it originated in the PR
  bodies themselves, and the plugin decision record defined its correctness oracle as "whatever the
  SCORM channel computes with a full census", i.e. the other channel was already the architecture.
- **The census was a security defect by design**: package-structural metadata (weights, order)
  learned from statements emitted by any enrolled learner's browser reshaped the reconstruction —
  and, through the terminal-status derivation, the completion — of every other learner.
- The consumer grades through its SCORM-compatible shim (site setting `xapiprimaryenabled=0`), which
  already routes per-item scores by stable objectid, multipage included, and computes its overall
  and completion server-side.

### Deriving weights/order from content.xml at import (consumer side)

Rejected: the weight is resolved per iDevice type at runtime from four undocumented storage shapes,
a naive reader is correct for 4 of 35 gradable types, and a mis-derived weight fails silently as a
wrong published grade. Recorded here so it is not re-proposed as a simplification.

### Scoping the emitter to web exports only (built, then reverted)

A mid-review revision removed the emitter from SCORM/IMS/EPUB packages entirely (an `emitsXapi()`
predicate plus a base-library filter), on the argument that those formats have their own
authoritative scoring channel. It was reverted once the consumer made the SCORM shim its default
grading channel: the decisive justification — `mod_exelearning` selecting its grading channel by
probing for the emitter file — was neutralized by that default, the split added a permanent
packaging axis threaded through five files (which caused a real bug: the emitter silently vanished
from the editor preview because the required-files list and the provider map disagreed), and it
shrank the reach of the very channel this ADR defines as analytics. What survived the revert: the
loader tag gated on the config, and identity config injection in every exporter.

### Moodle core_xapi and its State API

Rejected for grading: `core_xapi` provides statement routing/validation only (no attempts model, no
grading) and mandates actor == `$USER`, conflicting with the deliberate session-attributed anonymous
emitter. The State API (`xapi_states`) is per-user, auto-expiring and unqueryable — categorically the
wrong shape for durable package metadata. A per-user save-state feature would be its one fit.

## Consequences

- Multipage packages produce no attempt-level closure over xAPI. Consumers must not read
  `terminated` (emitted once per page visited) as end of attempt.
- Per-iDevice `answered` statements are the grading-relevant signal; they carry the stable
  `idevice-id`, the scaled/clamped score, and the package/page identity extensions.
- Single-page packages keep an accurate verdict, now robust to partial attempts.
- The wire carries no package-structural metadata from learners — the security property
  "students never define package structure" holds by construction.

## Validation

Unit tests pin: verdict suppression on `pageCount > 1`, the single-page verdict staying accurate for
partial attempts (25, not 100), seeding never overwriting an answered score, unresolvable page slots
never entering the aggregate, the 0..10 clamp at both ends, `pagehide`-only termination, and the
statements' shape against the real `gamification.scorm.getFinalScore`.

## References

- [ADR-2302-02](ADR-2302-02-ship-xapi-emitter-only-in-web-exports.md)
- [PR #2302](https://github.com/exelearning/exelearning/pull/2302)
- [`doc/elpx-format/tracking-emission.md`](../../elpx-format/tracking-emission.md)
