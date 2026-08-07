---
tracking_issue: 2232
title: "Issue-based architecture identifiers — tasks"
date: 2026-08-05
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# Issue-based architecture identifiers — tasks

## Plan

### Policy

- [x] Open the tracking issue with the problem, evidence and alternatives (#2232).
- [x] Write [ADR-2232-01](../../adr/ADR-2232-01-use-tracking-issue-based-architecture-identifiers.md).
- [x] Rewrite `doc/architecture/adr/README.md` — remove `max(existing) + 1`.
- [x] Rewrite `doc/architecture/adr/template.md` (renamed from `ADR-0000-template.md`).
- [x] Rewrite `doc/architecture/changes/README.md` (moved from `sdd/README.md`).
- [x] Rewrite `doc/architecture/changes/template.md` (moved from `SDD-0000-template.md`).
- [x] Update `doc/architecture.md`.
- [x] Update `doc/development/contributing.md`.
- [x] Update `AGENTS.md` §7.11.
- [x] Update `mkdocs.yml` nav.

### Migration

- [x] `git mv` the six ADRs to issue-based identifiers.
- [x] `git mv` `SDD-0009` to `changes/1858-file-attachment-restoration/design.md`.
- [x] Rewrite frontmatter: `id`, `tracking_issue`, `legacy_id`, `related.*`.
- [x] Rewrite H1 headings to `# <id>: <title>`.
- [x] Drop the duplicated `## Status` sections.
- [x] Rewrite cross-references between migrated records.
- [x] Write `doc/architecture/migration-map.md`.
- [x] Remove the empty `doc/architecture/sdd/` directory.

### Tooling

- [x] Write `scripts/architecture-records.mts` (`generate` / `check`).
- [x] Write `scripts/architecture-records.spec.ts`.
- [x] Add `make architecture-records` and `make architecture-check`.
- [x] Add the check to `make lint`.
- [x] Add the check to CI.

### Validation

- [x] `make architecture-check` passes.
- [x] `bun test scripts/architecture-records.spec.ts` passes.
- [x] Generated indexes match what is committed.
- [x] No retired identifier outside the migration map and `legacy_id`.
- [x] `mkdocs build --strict` passes.
- [x] `make lint` passes.

### Reconciliation

- [x] Inspect every open PR for architecture artifacts (13 found).
- [x] Migrate each affected branch to the new convention.
- [x] Report the reconciliation in the migration PR description.

## Progress

The migration PR carries the policy, the tooling and the `main`-branch migration.
Each affected open PR receives its own separate rename-only commit on its own
branch, so that reconciliation never mixes with the author's feature work and can
be reviewed independently.

Follow-up, tracked separately: apply the same model to the satellite repositories
(`wp-exelearning`, `omeka-s-exelearning`, `moodle-mod_exelearning`), each under its
own tracking issue.

## References

- Tracking issue: [#2232](https://github.com/exelearning/exelearning/issues/2232)
- Decision: [ADR-2232-01](../../adr/ADR-2232-01-use-tracking-issue-based-architecture-identifiers.md)
- Prior workflow: [#2148](https://github.com/exelearning/exelearning/issues/2148), [#2149](https://github.com/exelearning/exelearning/pull/2149)
