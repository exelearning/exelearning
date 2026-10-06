---
tracking_issue: NNNN   # issue number, or PR number when there is no issue
title: "Short change title"
status: draft
date: YYYY-MM-DD
authors:
  - "@github-user"
reviewers:
  - "@github-user"
implementation_prs: []
related_adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: ""
  model: ""
---

<!--
How to use this template:

1. Find the change's GitHub tracking NUMBER: its issue if it has one, otherwise
   its pull request. GitHub numbers issues and PRs from one shared sequence, so
   they never collide. That number IS the change's identity — there is no global
   counter and nothing to compute. NEVER open an issue just to get a number.
2. Create `doc/architecture/changes/<number>-<change-slug>/`.
3. Copy the frontmatter above into each document you create, and copy the
   matching section skeleton below into that document.
4. CREATE ONLY THE DOCUMENTS THAT CARRY REAL CONTENT. Empty placeholders are not
   required. A small change may be a single `proposal.md`.
5. Do not duplicate content across proposal.md, spec.md and design.md.
6. `implementation_prs` belongs ONLY in the canonical document — the first of
   proposal.md, spec.md, design.md, research.md, tasks.md that exists.
7. Status lives in the frontmatter only. Do not add a `## Status` section.
8. Record AI assistance in `ai_assistance` (values, or `none` if not used).
9. Run `make architecture-check` to validate.

Delete these guidance comments before submitting.
See ./README.md for the full policy.
-->

# Short change title — <document kind>

<!-- ======================================================================
     proposal.md — motivation, problem, scope, goals, non-goals
     ====================================================================== -->

## Motivation

<!-- Why this work is being done now. What is broken, missing or costly. -->

## Problem

<!-- The specific problem being solved, stated so that a reader can tell whether
a proposed solution actually solves it. -->

## Scope

<!-- What is in scope and what is explicitly out of scope. -->

## Goals

- ...

## Non-goals

- ...

<!-- ======================================================================
     spec.md — observable behavior, requirements, scenarios, acceptance
     ====================================================================== -->

## Requirements

<!-- Normative statements. Use must / must not / may. Number them so reviews and
tests can cite them. -->

## Scenarios

<!-- Concrete user-visible or API-visible scenarios: given / when / then. -->

## Acceptance criteria

- [ ] ...

<!-- ======================================================================
     design.md — technical implementation design
     ====================================================================== -->

## Current state

<!-- What exists today, with repository paths. -->

## Technical design

<!-- The implementation: modules, data flow, file layout, interfaces. -->

## Data model

<!-- Structures, schemas, storage. Note backward-compatibility constraints. -->

## Migration and compatibility

<!-- How existing data/content/users move to the new behavior. -->

## Security and privacy

## Accessibility

## Internationalization

## Performance

## Testing strategy

<!-- Unit, integration, E2E. Name the files that will hold the tests. -->

## Rollout plan

## Risks and mitigations

## ADRs required or referenced

<!-- Durable decisions in this change. Link an existing ADR, or mark
"ADR needed" and create `ADR-<issue>-<NN>-<decision-slug>.md`. -->

| Decision | ADR |
|---|---|
| ... | ADR-NNNN-01 |

<!-- ======================================================================
     research.md — evidence, experiments, alternatives, source analysis
     ====================================================================== -->

## Measurements

<!-- Numbers, with the method used to obtain them so they can be reproduced. -->

## Alternatives considered

<!-- Options that were evaluated and rejected, with the reason. -->

## External prior art

<!-- Primary sources: specifications, official documentation, comparable
implementations. Cite links; do not paste large excerpts. -->

<!-- ======================================================================
     tasks.md — implementation plan and progress
     ====================================================================== -->

## Plan

- [ ] Step 1
- [ ] Step 2

## Progress

<!-- Update as work lands. Link the PRs. -->

## References

<!-- Issues, PRs, ADRs, and external sources cited above. -->
