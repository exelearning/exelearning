---
id: ADR-2302-02
title: "Retire xAPI emission from exports"
status: Proposed
date: 2026-09-03
tracking_issue: 2302
deciders:
  - "@erseco"
related:
  prs: [1867, 2302, 2360]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "ChatGPT"
  model: "gpt-5.6-sol"
---

# ADR-2302-02: Retire xAPI emission from exports

## Context

The current xAPI emitter was introduced as an always-on export capability and was later consumed by `moodle-mod_exelearning` as an alternative tracking/grading channel.

That Moodle integration was removed in `exelearning/moodle-mod_exelearning#124`, which consolidated tracking and grading on SCORM. The optional Moodle analytics follow-up in `exelearning/exelearning#2054` was also closed as not planned.

Keeping the existing xAPI implementation would therefore mean maintaining a statement contract, transport logic, lifecycle semantics and tests without a current product requirement or known in-project consumer.

## Decision

Retire xAPI emission from eXeLearning exports, in full and in one step: the emitter library, the `window.exeXapi` identity config, the `XapiConfig` type, the base-library and resource-copy entries, and the `gamification.track()` dispatch hop all go. No compatibility shim is left behind — a stub asset that nothing reads is plumbing without a consumer, which is the very thing this decision retires.

xAPI is not rejected as a future capability. A future implementation should be treated as a new feature and should require a concrete consumer, an explicit statement contract, clear attempt/session semantics, an identity and trust model, and end-to-end interoperability tests.

## Consequences

- New exports no longer emit xAPI statements.
- Existing already-exported packages are unaffected because they contain their own bundled runtime.
- SCORM tracking and grading remain unchanged.
- `libs/xapi/exe_xapi.js` is no longer produced, referenced or copied by any export path, and integration tests assert that it stays gone.
- `PageRenderer.serializeForScript()` is removed with its only caller. A future feature that inlines JSON into a `<script>` element must reintroduce equivalent escaping (`<`, U+2028, U+2029); see this ADR's implementation PR for the previous version.
