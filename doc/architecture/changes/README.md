# Architecture changes

## Purpose

A **change** is one unit of significant technical work, identified by its GitHub
tracking issue. Its documents describe *what* will be built and *how* it will be
implemented: goals, non-goals, observable behavior, technical design, migration,
security, accessibility, testing and rollout — agreed **before** implementation
starts.

Change documents make a big change reviewable as a whole, instead of arriving as a
large pull request that reviewers must reverse-engineer.

## A note on the term "SDD"

These documents were previously called **Software Design Documents (SDD)** and
numbered `SDD-NNNN`. That name is retired for two reasons: the global counter it
used was unsafe on parallel branches (see
[ADR-2232-01](../adr/ADR-2232-01-use-tracking-issue-based-architecture-identifiers.md)),
and "SDD" is increasingly used across the wider ecosystem to mean **Spec-Driven
Development**, which is a different thing.

Use **"change document"**, **"design document"**, or simply the concrete filename
(`design.md`, `proposal.md`) instead. Existing documents are preserved;
[`../migration-map.md`](../migration-map.md) maps each retired identifier to its
current path.

## Changes vs ADRs

| Artifact | Answers | Lifetime |
|----------|---------|----------|
| **Change document** | *What* will be built and *how* it will be implemented | May become historical once implemented |
| **ADR** | *Which* durable decision was made and *why* | Long-lived, append-only |

A change is a **design**; an [ADR](../adr/README.md) is a **decision**. A single
change often contains several durable decisions (a storage choice, a compatibility
guarantee, a security boundary). Those belong in ADRs so they outlive the feature
work — the change then links to them via `related_adrs` instead of burying them in
prose.

> Every significant proposal may start with a change directory. Every durable
> architectural decision inside it should either link to an existing ADR or
> propose a new one — but do **not** create one ADR per section.

## Identification and layout

One directory per tracking issue:

```text
doc/architecture/changes/<tracking-number>-<change-slug>/
```

```text
doc/architecture/changes/1858-file-attachment-restoration/
doc/architecture/changes/2232-issue-based-architecture-identifiers/
```

- **A GitHub tracking number is required.** It is the change's issue when it has
  one, and its pull request when it does not — GitHub draws both from a single
  repository-wide sequence, so they never collide. Its number *is* the change's
  identity. There is no global counter and no next-free-number to compute, and
  no issue should be opened just to obtain one.
- `<change-slug>` is lowercase kebab-case.
- Every document in the directory carries `tracking_issue`, and it must match the
  directory prefix. CI enforces this.

### Documents

| File | Responsibility |
|------|----------------|
| `proposal.md` | Motivation, problem, scope, goals, non-goals |
| `spec.md` | Observable behavior, requirements, scenarios, acceptance criteria |
| `design.md` | Technical implementation design |
| `research.md` | Evidence, experiments, alternatives, source analysis |
| `tasks.md` | Implementation plan and progress |

**Create only the files that carry real content.** Empty placeholders are not
required and should not be added to complete the set. A small change may be a
single `proposal.md`; a large one may use all five.

**Do not duplicate the same content** across `proposal.md`, `spec.md` and
`design.md`. Each answers a different question.

### Canonical metadata

Mutable change-level metadata (`title`, `status`, `implementation_prs`,
`related_adrs`) lives in exactly one file: the **first** of `proposal.md`,
`spec.md`, `design.md`, `research.md`, `tasks.md` that exists in the directory.
Other documents may repeat `tracking_issue`, `title`, `status` and `date`, but
must not declare `implementation_prs` — that would create a second source of
truth, and CI rejects it.

```yaml
tracking_issue: 1858
title: "File Attachment iDevice Restoration"
status: implemented
date: 2026-07-09
authors:
  - "@erseco"
implementation_prs:
  - 2011
related_adrs:
  - ADR-1858-01
  - ADR-1858-02
```

`implementation_prs` is **traceability metadata**: it lists every PR that
implements the change. When a change has no issue, its PR number *is* the
tracking number — but that is the single, stable number in `tracking_issue`, not
the growing list in `implementation_prs`.

- [`template.md`](template.md) is the canonical starting point.
- There is **no committed index**. Run `make architecture-records` to print one.

## Status values

| Status | Meaning |
|--------|---------|
| `draft` | Being written; not yet ready for review. |
| `in-review` | Under review; open for feedback. |
| `accepted` | Design agreed; implementation may start. |
| `implemented` | The design has shipped. Kept as a historical record. |
| `superseded` | Replaced by a newer change (see `superseded_by`). |
| `abandoned` | Dropped before implementation. Kept for the record. |

Status lives in the frontmatter **only**. Do not add a `## Status` section.

A change can be edited freely while it is `draft` or `in-review`. Once
`implemented`, avoid rewriting it except for typo/link fixes. If the design
changes substantially, create a new change directory under a new tracking issue
and mark the previous one `superseded`.

## When a change document is required

Write one for work that needs a design gate before implementation:

- significant new features;
- major refactors or rewrites of a subsystem;
- cross-cutting changes (export pipeline, collaboration, storage, embedding);
- proposals with multiple implementation phases;
- changes that touch several of: architecture, storage, file formats,
  import/export, security, accessibility, or public APIs.

## When it is not required

Skip it for:

- bug fixes and small enhancements;
- localized changes with an obvious implementation;
- work already fully covered by an existing, current change document.

A durable decision that needs no full design can go straight to an
[ADR](../adr/README.md).

## Relationship to OpenSpec and spec-driven workflows

Tools such as [OpenSpec](https://github.com/Fission-AI/OpenSpec) and
[GitHub Spec Kit](https://github.com/github/spec-kit) organize each change as a
self-contained folder carrying its proposal, specs, design and tasks. This layout
is deliberately modelled on that pattern, and the per-change directory names
follow the same kebab-case convention.

The main eXeLearning repository does **not** adopt OpenSpec or any external spec
tool as a dependency. They are referenced as prior art; adopting one formally
would be its own architecture decision, and would need its own ADR.

## Evidence and traceability

As with ADRs, technical claims should cite a verifiable source: a repository path
plus commit, official documentation, a benchmark, a reproducible experiment, or a
linked issue, PR or ADR. Put evidence in `research.md` when there is enough of it
to warrant its own document; otherwise keep it inline.

## AI-assisted change documents

If an AI tool helped draft or research a document, disclose it in the frontmatter:

```yaml
ai_assistance:
  tool: "Claude Code"        # tool / interface used
  model: "claude-opus-5"     # model, when relevant
```

If no AI tool was involved, set both fields to `none`.

## Referencing changes

- **From a PR or issue:** mention the change directory, e.g.
  `changes/1858-file-attachment-restoration`.
- **From an ADR:** list the directory name under `related.changes`.
- **From docs:** link the concrete file,
  `[design](changes/1858-file-attachment-restoration/design.md)`.

Retired identifiers must not appear in new content. CI fails on them; use
[`../migration-map.md`](../migration-map.md) to find the current path.

## Workflow

1. Identify the change's **GitHub tracking number** — its issue if it has one,
   otherwise its pull request. Do not open an issue just to get a number.
2. Create `doc/architecture/changes/<number>-<change-slug>/`.
3. Copy the relevant sections of [`template.md`](template.md) into the documents
   you actually need. Start at `status: draft`.
4. Capture durable decisions as [ADRs](../adr/README.md) named
   `ADR-<number>-<NN>-<decision-slug>.md`, and list them in `related_adrs`.
5. Run `make architecture-check` to validate. `make architecture-records` prints
   the current index if you want to read it.
6. Open (or reference) a PR and move to `in-review`.
7. On approval, set `accepted` and implement. When it ships, set `implemented`
   and record the PRs in `implementation_prs`.

## Review checklist

- [ ] The change has a tracking number (issue, or PR when there is no issue),
      and the directory uses it.
- [ ] Every document's `tracking_issue` matches the directory.
- [ ] Only documents with real content exist; no empty placeholders.
- [ ] Content is not duplicated across `proposal.md`, `spec.md` and `design.md`.
- [ ] Goals and non-goals are explicit.
- [ ] Migration/compatibility, security, accessibility and testing are addressed.
- [ ] Durable decisions are captured as ADRs and listed in `related_adrs`.
- [ ] Every technical claim cites a verifiable source.
- [ ] `status` reflects reality, and appears only in the frontmatter.
- [ ] `ai_assistance` is filled in (values or `none`).
- [ ] `make architecture-check` passes.
