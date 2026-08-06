---
tracking_issue: 2232
title: "Issue-based architecture identifiers"
status: in-review
date: 2026-08-05
authors:
  - "@erseco"
reviewers:
  - "@erseco"
implementation_prs: []
related_adrs: [ADR-2232-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# Issue-based architecture identifiers — proposal

## Motivation

Architecture records were identified by a globally sequential counter allocated as
`max(existing) + 1` against the author's working tree. Nothing coordinated that
allocation across branches, so independent branches silently reserved the same
identifier. Because the collision lands in the *filename*, Git merges both files
cleanly and reports nothing.

The failure is already widespread. Across `main` and the 13 open pull requests
carrying architecture artifacts — 67 artifact claims on 14 branches — **16
identifiers are claimed by more than one branch**, and `ADR-0001` is claimed by
six.

## Problem

Three distinct problems share one root cause:

1. **Allocation contention.** A global counter cannot be allocated safely from
   parallel branches without a coordination mechanism, and any such mechanism is
   itself a conflict hotspot.
2. **Meaningless ordering.** The integer records which branch computed
   `max(existing) + 1` first, not when anything was created, reviewed, accepted or
   implemented. On `main`, `ADR-0001` was the *newest* record.
3. **Index and metadata rot.** Hand-maintained `records.md` files drifted out of
   date — four ADRs and one SDD on `main` appeared in no index — and nothing
   validated frontmatter, so field shapes diverged between records.

A fourth, smaller problem: "SDD" is used here for "Software Design Document" while
the wider ecosystem increasingly uses it for "Spec-Driven Development". Our own
policy document had to disambiguate the two in prose.

## Scope

**In scope**

- Replacing the identifier model for ADRs and design documents.
- Migrating the 6 ADRs and 1 SDD on `main`, both templates, both indexes and both
  policy READMEs.
- Replacing `doc/architecture/sdd/` with `doc/architecture/changes/`.
- A repository-local validation and index-generation tool, wired into `make` and CI.
- Updating `AGENTS.md`, `doc/architecture.md`, `doc/development/contributing.md`
  and `mkdocs.yml`.
- Reconciling the 13 open PRs that carry architecture artifacts.

**Out of scope**

- Any change to production behavior, application code, or exported output.
- Adopting OpenSpec, Spec Kit, or any external spec tool as a dependency.
- Rewriting the substance of existing decisions.
- Backfilling records for past changes that never had one.
- The satellite repositories, which are migrated separately under their own
  tracking issues.

## Goals

- An identifier that can be allocated on an independent branch with no coordination.
- An identifier short enough to cite from a code comment or a review.
- An identifier that is stable once published.
- An explicit model for "one change, several decisions, several PRs".
- Indexes that cannot drift, because they are generated and CI-verified.
- A migration that preserves every existing record, its history and its links.

## Non-goals

- Making identifiers globally sortable. Chronology belongs in the generated index.
- Making the identifier space dense. Gaps are a consequence of having no counter.
- Preventing a record from being filed under the wrong issue. The format cannot
  detect a wrong-but-valid issue number.

## Proposed solution

Use the GitHub tracking number as the namespace for a change — the issue when the
change has one, and the pull request when it does not. GitHub allocates issue and
pull-request numbers from a single repository-wide sequence, so the two can never
collide, and no issue ever has to be opened purely to obtain an identifier. See
[ADR-2232-01](../../adr/ADR-2232-01-use-tracking-issue-based-architecture-identifiers.md)
for the decision and the options that were rejected, [`spec.md`](spec.md) for the
normative rules, [`design.md`](design.md) for the tooling design, and
[`research.md`](research.md) for the external prior art.
