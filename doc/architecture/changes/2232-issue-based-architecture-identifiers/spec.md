---
tracking_issue: 2232
title: "Issue-based architecture identifiers — specification"
date: 2026-08-05
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# Issue-based architecture identifiers — specification

Normative rules for architecture record identification, metadata and validation.
Keywords **must**, **must not** and **may** are used in the usual sense.

## 1. Tracking numbers

- Every architecture change **must** have a GitHub **tracking number** before its
  durable artifacts are finalized.
- The tracking number is the change's **issue** when it has one, and its **pull
  request** when it does not. GitHub allocates issue and pull-request numbers from
  a single repository-wide sequence, so the two **can never collide**; in GitHub's
  data model a pull request is an issue, and `/issues/<n>` resolves to it.
- An issue **must not** be opened for the sole purpose of obtaining an identifier.
- The issue **should** be preferred when one exists: it predates implementation and
  survives a change delivered by several pull requests.
- The tracking number is chosen once and is then **stable**. If a change that
  started as a pull request later gains an issue, the identifier **must not**
  change.
- `implementation_prs` / `related.prs` are traceability lists and **must not** be
  treated as the identifier.

## 2. ADR identifiers

### 2.1 Filename grammar

```text
ADR-<issue>-<local-sequence>-<decision-slug>.md
```

- `<issue>` — the tracking number, one or more digits, no leading zeros.
- `<local-sequence>` — exactly two digits, scoped to that issue, starting at `01`.
- `<decision-slug>` — lowercase kebab-case, `[a-z0-9]+(-[a-z0-9]+)*`.

Regular expression:

```text
^ADR-(?<issue>[1-9][0-9]*)-(?<seq>[0-9]{2})-(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\.md$
```

### 2.2 Rules

- The local sequence **must** start at `01` and **must not** be reused within the
  same issue, even if a record is deleted or rejected.
- The local sequence **must** be present even when an issue has a single ADR, so
  that adding a second ADR later never renames the first.
- The slug **must** describe the decision, not the general topic. `use-asset-uri-references`
  is a decision; `file-attachment` is a topic.
- Frontmatter `id` **must** equal `ADR-<issue>-<local-sequence>`.
- Frontmatter `tracking_issue` **must** equal `<issue>`.
- The document H1 **must** be `# <id>: <title>`.
- Identifiers **must not** be reused after a record is published. A superseded
  record keeps its identifier.

### 2.3 Example

```text
doc/architecture/adr/ADR-1858-01-restore-file-attachment-as-json-idevice.md
doc/architecture/adr/ADR-1858-02-use-asset-uri-references.md
doc/architecture/adr/ADR-1858-03-remap-legacy-file-attachments.md
doc/architecture/adr/ADR-1858-04-fail-safe-accessible-attachment-rendering.md
```

## 3. Change directories

### 3.1 Directory grammar

```text
doc/architecture/changes/<issue>-<change-slug>/
```

Regular expression:

```text
^(?<issue>[1-9][0-9]*)-(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)$
```

### 3.2 Recognised documents

| File | Responsibility |
|---|---|
| `proposal.md` | Motivation, problem, scope, goals, non-goals |
| `spec.md` | Observable behavior, requirements, scenarios, acceptance criteria |
| `design.md` | Technical implementation design |
| `research.md` | Evidence, experiments, alternatives, source analysis |
| `tasks.md` | Implementation plan and progress |

- Only files carrying real content **must** be created. Empty placeholders are not
  required and **must not** be added to satisfy the list.
- The same content **must not** be duplicated across `proposal.md`, `spec.md` and
  `design.md`.
- A directory **must** contain at least one recognised document.
- Files other than the five above **may** exist (diagrams, data) and are ignored by
  the validator.

### 3.3 Canonical metadata carrier

Mutable change-level metadata (`title`, `status`, `implementation_prs`,
`related_adrs`) lives in exactly one file: the **first** of `proposal.md`,
`spec.md`, `design.md`, `research.md`, `tasks.md` that exists in the directory.

Other documents in the directory **may** repeat `tracking_issue`, `title`,
`status`, `date` and `related_adrs`; where they do, `tracking_issue` **must** match
the directory. They **must not** declare `implementation_prs`, which would create a
second source of truth.

## 4. Frontmatter schema

### 4.1 ADR

| Field | Required | Type |
|---|---|---|
| `id` | yes | `ADR-<issue>-<NN>` |
| `title` | yes | string |
| `status` | yes | `Proposed` \| `Accepted` \| `Rejected` \| `Superseded` |
| `date` | yes | `YYYY-MM-DD` |
| `tracking_issue` | yes | positive integer — the tracking number (issue, or PR when there is no issue) |
| `legacy_id` | no | previous identifier, migrated records only |
| `deciders` | yes | list of `@handle` |
| `reviewers` | no | list of `@handle` |
| `related.prs` | no | list of positive integers |
| `related.changes` | no | list of change-directory names |
| `related.adrs` | no | list of ADR ids |
| `supersedes` | no | list of ADR ids |
| `superseded_by` | no | list of ADR ids |
| `ai_assistance.tool` | yes | string or `none` |
| `ai_assistance.model` | yes | string or `none` |

### 4.2 Change document

| Field | Required | Type |
|---|---|---|
| `tracking_issue` | yes | positive integer, equal to the directory prefix (issue, or PR when there is no issue) |
| `title` | yes | string |
| `status` | yes | `draft` \| `in-review` \| `accepted` \| `implemented` \| `superseded` \| `abandoned` |
| `date` | yes | `YYYY-MM-DD` |
| `legacy_id` | no | previous identifier, migrated records only |
| `authors` | yes | list of `@handle` |
| `reviewers` | no | list of `@handle` |
| `implementation_prs` | no | list of positive integers, canonical carrier only |
| `related_prs` | no | list of positive integers |
| `related_adrs` | no | list of ADR ids |
| `supersedes` | no | list of change-directory names |
| `superseded_by` | no | list of change-directory names |
| `ai_assistance.tool` | yes | string or `none` |
| `ai_assistance.model` | yes | string or `none` |

Status is recorded in frontmatter **only**. A `## Status` section duplicating it
**must not** be added.

## 5. Supersession

- An accepted ADR **must not** be rewritten in meaning. It is superseded.
- The superseding ADR sets `supersedes: [<old-id>]`.
- The superseded ADR sets `status: Superseded` and `superseded_by: [<new-id>]`.
- Both directions **must** be present; the validator rejects a one-sided
  relationship.
- An ADR **must not** supersede itself, and `supersedes` / `superseded_by`
  **must** reference records that exist.

## 6. Indexes

- The record index **must not** be committed. It is derived entirely from
  frontmatter, it is contributor-facing rather than published documentation, and a
  generated file in version control conflicts on every concurrent branch.
- `make architecture-records` **must** print it to stdout on demand.
- ADRs are sorted by tracking number ascending, then local sequence ascending.
- Changes are sorted by tracking number ascending.
- Rendering **must** be deterministic: the same input produces byte-identical
  output.
- `doc/architecture/adr/` and `doc/architecture/changes/` **must** be excluded
  from the MkDocs site.

## 7. Validation

`bun run scripts/architecture-records.mts check` **must** fail when any of the
following holds:

1. A required field is missing.
2. An ADR filename does not match the grammar in §2.1.
3. A change directory name does not match the grammar in §3.1.
4. Frontmatter `id` does not match the filename.
5. Frontmatter `tracking_issue` does not match the filename or directory.
6. Two ADRs share an `id`.
7. Two ADRs in the same issue share a local sequence.
8. A `status` value is outside the allowed set for its artifact type.
9. A `date` is not a real `YYYY-MM-DD` date.
10. A referenced ADR id does not resolve to an existing record.
11. A referenced change-directory name does not resolve to an existing directory.
12. An issue or PR reference is not a positive integer.
13. `supersedes` / `superseded_by` are not symmetric, or reference a missing record.
14. A legacy `ADR-NNNN` or `SDD-NNNN` identifier is referenced anywhere in the
    repository outside the migration map and `legacy_id` fields.
15. A file named `ADR-NNNN-*.md` or `SDD-NNNN-*.md` exists under `doc/architecture/`.
16. A change directory contains no recognised document.
17. A non-canonical change document declares `implementation_prs`.
18. An ADR H1 does not match `# <id>: <title>`.
19. A `records.md` is committed under `doc/architecture/`.

Error messages **must** name the offending file, the field, and the expected value.

## 8. Acceptance criteria

- [ ] `bun run scripts/architecture-records.mts check` exits 0 on this branch.
- [ ] `bun run scripts/architecture-records.mts list` prints both indexes.
- [ ] No `ADR-[0-9]{4}-*` or `SDD-[0-9]{4}-*` file exists under `doc/architecture/`.
- [ ] No legacy identifier is referenced outside the migration map and `legacy_id`.
- [ ] Every legacy identifier resolves through the migration map to a current path.
- [ ] `mkdocs build --strict` succeeds.
- [ ] `make fix` and `make lint` are clean.
- [ ] The validator's own unit tests pass.
- [ ] CI runs the check on every PR touching `doc/architecture/**`.
- [ ] No `records.md` is committed under `doc/architecture/`.
