---
id: ADR-2302-02
title: "Retire the current xAPI emitter"
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

# ADR-2302-02: Retire the current xAPI emitter

## Context

The current xAPI emitter was introduced as an always-on export capability and was later consumed by `moodle-mod_exelearning` as an alternative tracking/grading channel.

That Moodle integration was removed in `exelearning/moodle-mod_exelearning#124`, which consolidated tracking and grading on SCORM. The optional Moodle analytics follow-up in `exelearning/exelearning#2054` was also closed as not planned.

Keeping the existing xAPI implementation would therefore mean maintaining a statement contract, transport logic, lifecycle semantics and tests without a current product requirement or known in-project consumer.

## Decision

Retire the current xAPI emitter implementation.

The historical `libs/xapi/exe_xapi.js` path is temporarily kept as a no-op compatibility shim so exporter code that still references the asset does not generate a broken package while the remaining exporter plumbing is removed.

xAPI is not rejected as a future capability. A future implementation should be treated as a new feature and should require a concrete consumer, an explicit statement contract, clear attempt/session semantics, an identity and trust model, and end-to-end interoperability tests.

## Consequences

- New exports no longer emit xAPI statements.
- Existing already-exported packages are unaffected because they contain their own bundled runtime.
- SCORM tracking and grading remain unchanged.
- The compatibility shim and remaining xAPI-specific exporter plumbing can be removed once no export path references the historical asset.
