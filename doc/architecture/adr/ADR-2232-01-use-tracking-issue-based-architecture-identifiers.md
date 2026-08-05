---
id: ADR-2232-01
title: "Identify architecture records by tracking issue instead of a global counter"
status: Proposed
date: 2026-08-05
tracking_issue: 2232
deciders:
  - "@erseco"
reviewers:
  - "@erseco"
related:
  prs: []
  changes: ["2232-issue-based-architecture-identifiers"]
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-2232-01: Identify architecture records by tracking issue instead of a global counter

## Context

The architecture documentation workflow adopted in [#2148](https://github.com/exelearning/exelearning/issues/2148) /
[#2149](https://github.com/exelearning/exelearning/pull/2149) gave Architecture
Decision Records and Software Design Documents globally sequential identifiers.
Both policy documents stated the allocation rule as:

> IDs are zero-padded, monotonic and never reused. The next ID is `max(existing) + 1`.

`max(existing)` is evaluated against whatever tree the author happens to have
checked out. Nothing coordinates that evaluation across branches, and Git cannot
detect the resulting conflict because it manifests as two *differently named*
files that merge cleanly — not as a textual conflict.

The policy was never recorded as an ADR. It exists only in
[`doc/architecture/adr/README.md`](README.md), [`doc/architecture/changes/README.md`](../changes/README.md)
(formerly `doc/architecture/sdd/README.md`) and the two templates. There is
therefore no accepted ADR to supersede; this ADR is the first record of the
identification model, and the README files are updated to reference it.

## Problem

How should architecture decision records and change design documents be
identified, so that identifiers can be allocated on independent branches without
coordination, remain stable once published, and model the real relationship
between a tracked change, its decisions and its implementation pull requests?

## Decision drivers

- **Parallel branches must not contend for an identifier.** eXeLearning routinely
  has a dozen or more open PRs touching architecture documents.
- **Identifiers must be citable.** A record is referenced from code comments,
  reviews, issues and other records; the ID has to be short enough to type and
  recognise.
- **Identifiers must be stable.** Renaming a published record breaks inbound links.
- **One change may produce several decisions**, and may take several PRs.
- **Indexes must not rot.** Whatever is written by hand will drift.
- **The model must be legible to contributors and to AI agents**, both of which
  currently follow a `max(existing) + 1` instruction that is provably unsafe.

## Options considered

### Option 1: Keep global sequential IDs, add locking or reservation

Add a reserved-numbers file, a bot, or an issue label that hands out the next
free integer.

- **Pros:** identifiers stay short and dense; no migration.
- **Cons:** the reservation registry becomes the new merge-conflict hotspot; it is
  a global counter under a different name; it fails for work started offline or in
  a fork; and it adds a synchronous step before a contributor can write anything.

### Option 2: Assign the number when the PR is opened (Rust RFC model)

Rust RFCs are named `0000-my-feature.md` until the PR exists, then renamed to the
PR number ([rust-lang/rfcs](https://github.com/rust-lang/rfcs)).

- **Pros:** proven at very large scale; GitHub allocates the number, so no
  contention.
- **Cons:** every record is unnamed until a PR exists and must then be renamed;
  the identity of a *durable decision* becomes a property of a *review artifact*;
  and a change delivered by several PRs has no single number.

### Option 3: Use the PR number as the identifier, always

- **Pros:** same allocation benefit, no placeholder phase, and nothing extra to
  create — every change has a pull request eventually.
- **Cons:** as the *only* rule it is the sharpest form of Option 2's flaw. Issue
  #1858 produced one design and four decisions delivered by PR #2011; a follow-up
  fix PR would either have to borrow #2011's namespace or fragment the change
  across two numbers. It also has no identifier until the branch is pushed.
- **Partially adopted.** Issue and pull-request numbers come from a single
  repository-wide sequence, so a PR number is exactly as collision-free as an
  issue number. Option 6 therefore uses the PR number as the namespace whenever a
  change has no tracking issue, rather than forcing an issue to be opened.

### Option 4: Dates plus slugs

`2026-08-05-use-asset-uri-references.md`.

- **Pros:** no contention; ordering is honest.
- **Cons:** no short stable ID to cite from a code comment; same-day records still
  need a tiebreaker. Kubernetes used `draft-YYYYMMDD-my-title.md` and moved away
  from it.

### Option 5: UUIDs or ULIDs

- **Pros:** collision-free by construction, fully decentralised.
- **Cons:** unreadable and effectively uncitable. `ADR-01J8XQ3M…` cannot be used
  in a review conversation or a code comment.

### Option 6: Tracking-number-based identifiers

`ADR-<number>-<local-sequence>-<slug>.md`, with change documents in
`doc/architecture/changes/<number>-<slug>/`, where `<number>` is the tracking
issue when the change has one and the pull request otherwise.

- **Pros:** GitHub allocates the namespace from one shared sequence, so issues and
  pull requests can be mixed without ever colliding; the collision domain shrinks
  to a single change, whose participants are already coordinating; the number is a
  working breadcrumb back to the discussion; several decisions per change are
  modelled explicitly; when an issue exists the identifier predates any PR; and no
  issue ever has to be opened just to obtain a number.
- **Cons:** identifiers are longer; the sequence is sparse and not globally
  sortable; the number alone does not reveal whether it is an issue or a PR.

### Option 7: Store records outside the working tree in Git notes

[git-adr](https://github.com/zircote/git-adr) keeps ADRs in Git notes — "no files,
no merge conflicts".

- **Pros:** eliminates file-level conflicts entirely.
- **Cons:** records stop appearing in PR diffs, stop rendering in MkDocs, and
  become invisible to anyone browsing the repository. Too high a price for a
  problem that a naming rule solves.

## Evidence

- **The collision is real, not hypothetical.** Measured across `main` and the 13
  open PRs carrying architecture artifacts (67 artifact claims on 14 branches),
  16 identifiers are claimed more than once. `ADR-0001` is claimed by six
  branches: `main` (`runtime-specific-elpx-import-limits`), [#2209](https://github.com/exelearning/exelearning/pull/2209)
  (`scorm12-runtime-rewrite`), [#2199](https://github.com/exelearning/exelearning/pull/2199)
  (`source-aware-preview-filtering`), [#2164](https://github.com/exelearning/exelearning/pull/2164)
  (`database-backed-yjs-version-history`), [#2157](https://github.com/exelearning/exelearning/pull/2157)
  (`three-d-viewer-interaction-layer`) and [#2147](https://github.com/exelearning/exelearning/pull/2147)
  (`native-inline-interactive-video-editor`). `ADR-0020`–`ADR-0024` are each claimed
  twice (#2199 and #2007), as are `ADR-0016`–`ADR-0019`, `ADR-0043` and `SDD-0001`.
- **Numeric order does not encode creation order.** On `main` before this change,
  `ADR-0035` was dated 2026-07-09, `ADR-0042` 2026-07-16 and `ADR-0001`
  2026-07-21 — the lowest number was the newest record.
- **Hand-maintained indexes were already stale.** `doc/architecture/adr/records.md`
  on `main` omitted `ADR-0035`, `ADR-0036`, `ADR-0037` and `ADR-0038` entirely, and
  `doc/architecture/sdd/records.md` declared "No draft SDDs yet" while
  `SDD-0009-file-attachment-idevice-restoration.md` existed with
  `status: Implemented`.
- **Unvalidated metadata drifted.** `ADR-0042` recorded `issues: ["#2184"]` (quoted,
  with a `#`) where every other record used a bare integer.
- **Kubernetes solved this the same way.** *"KEPs are now prefixed with their
  associated tracking issue number. This gives both the KEP a unique identifier and
  provides an easy breadcrumb for people to find the issue where the current state
  of the KEP is being updated."* — [keps/README.md](https://github.com/kubernetes/enhancements/blob/master/keps/README.md).
  KEP directories are literally `1143-node-role-labels`, `4330-compatibility-versions`.
- **Locally scoped ADR numbers are within the MADR tradition.** MADR's default is
  `NNNN-title-with-dashes.md`, but it notes that with subdirectories *"numbers of
  ADRs are no longer unique throughout the repository, but locally within a
  category only"* — [adr.github.io/madr](https://adr.github.io/madr/).
- **Per-change directories are established practice.** OpenSpec packages each
  change as a folder holding `proposal.md`, `design.md`, `tasks.md` and `specs/`
  ([concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md));
  GitHub Spec Kit uses `specs/003-chat-system/` with `spec.md`, `plan.md`,
  `research.md`, `tasks.md` ([spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md)).
- **Index generation is a solved, tooled concern.** adr-tools ships
  `adr generate toc` ([npryce/adr-tools](https://github.com/npryce/adr-tools)).

## Decision

We will identify architecture records by their **GitHub tracking number** — the
issue when the change has one, otherwise the pull request — and generate every
index from document metadata.

Concretely:

1. **Stop assigning globally sequential ADR and SDD numbers.** The
   `max(existing) + 1` rule is removed from the active policy and is not replaced
   by any other global counter, registry or reservation mechanism.

2. **The GitHub tracking number is the namespace for a change** — the tracking
   issue when the change has one, otherwise its pull request. GitHub draws issue
   and pull-request numbers from a **single repository-wide sequence**, so the
   two can never collide: this ADR's tracking issue is
   [#2232](https://github.com/exelearning/exelearning/issues/2232) and the pull
   request that implements it is
   [#2233](https://github.com/exelearning/exelearning/pull/2233). In GitHub's own
   data model a pull request *is* an issue, which is why `/issues/2233` resolves
   to that pull request.

   Prefer the issue when one exists: it predates implementation, survives a
   change delivered by several pull requests, and is where the discussion lives.
   But **nobody should open an issue merely to obtain an identifier** — a change
   that starts life as a pull request uses that pull request's number.

3. **ADRs are named** `ADR-<issue>-<local-sequence>-<decision-slug>.md`, with
   frontmatter `id` matching the filename and `tracking_issue` matching the issue.
   The local sequence is two digits, scoped to that issue alone, starting at `01`,
   never reused within the issue. It is present even when an issue has only one
   ADR, so that adding a second later never renames the first. The slug names the
   decision, not the topic.

4. **Change specifications and designs live in**
   `doc/architecture/changes/<issue>-<change-slug>/`, holding `proposal.md`,
   `spec.md`, `design.md`, `research.md` and `tasks.md` as needed. Only files with
   real content are created. The `SDD-NNNN` identifier is retired for new
   documents, and "SDD" stops being the primary artifact name — the ambiguity with
   "Spec-Driven Development" is resolved by naming the concrete file instead.

5. **The record index is never committed.** `make architecture-records` prints it
   from frontmatter on demand. A generated file in version control conflicts on
   every concurrent branch — exactly the class of problem this ADR removes — and
   these records are contributor-facing, so they are also excluded from the
   published MkDocs site.

6. **CI validates** identifiers, required fields, statuses, dates, cross-references,
   supersession symmetry, legacy-ID references, and that no index file has been
   committed.

7. **PR numbers are traceability metadata only** (`implementation_prs`,
   `related_prs`). They are never the primary identifier, because a change may have
   several implementation PRs and the identifier must exist before any of them.

8. **Historical documents are preserved through an explicit migration map**
   (`doc/architecture/migration-map.md`). Renames use `git mv`; every record keeps a
   `legacy_id` field; no accepted decision is rewritten in meaning.

## Consequences

### Positive

- Two branches can only collide on an identifier if they share a tracking number,
  at which point their authors are already coordinating. The 16 current collisions
  become zero.
- No new process is forced on anyone: a change that never had an issue uses its
  pull-request number, so the convention never requires opening an issue purely to
  obtain an identifier.
- The identifier is a working link back to the discussion where the change is
  coordinated.
- A change with several decisions is modelled as such, and adding a fifth decision
  to issue #1858 never renames the first four.
- Indexes cannot rot, because none is stored: the listing is derived on demand.
- No generated file sits in version control, so no branch conflicts on one.
- Contributors and AI agents no longer follow an instruction (`max(existing) + 1`)
  that is unsafe by construction.

### Negative

- A change must have *some* GitHub number — an issue or an open pull request —
  before its durable artifacts are finalized. In practice every change already
  has one, so this is close to free, but a record written entirely offline has
  no identifier until the branch is pushed.
- Identifiers are longer: `ADR-0035` becomes `ADR-1858-01`.
- The number alone does not say whether it refers to an issue or a pull request.
  That is deliberate — both resolve under `/issues/<n>` — but it means a reader
  cannot tell the two apart without following the link.
- The identifier space is sparse and not globally sortable. Chronology moves to the
  generated index, which can sort by date, status or issue — none of which the
  integer actually encoded either.
- A one-time migration renames every existing record and requires every open PR
  carrying architecture artifacts to be reconciled.

### Neutral

- Records remain plain Markdown with YAML frontmatter, rendered by MkDocs. No
  external ADR or spec tool is adopted; doing so would be its own decision.
- The local sequence is per-issue, so identifiers are unique repository-wide only
  as the pair (issue, sequence) — which is exactly what the validator enforces.

## Risks

- **A record filed under the wrong issue** is a real failure mode that the format
  cannot prevent. The validator checks that `tracking_issue` is numeric and that
  it matches the filename, which catches typos but not a wrong-but-valid number.
- **Reconciling 13 open PRs** risks conflicts with in-flight work. Mitigated by
  making each reconciliation a separate, rename-only commit.
- **Contributors may keep copying the old convention** from muscle memory or from a
  stale branch. Mitigated by CI rejecting `ADR-NNNN` filenames and legacy-ID
  references.

## Validation

- `bun run scripts/architecture-records.mts check` passes in CI on every PR
  touching `doc/architecture/**`.
- No `records.md` exists under `doc/architecture/`.
- No file matching `ADR-[0-9]{4}-` or `SDD-[0-9]{4}-` exists under
  `doc/architecture/`.
- `mkdocs build --strict` succeeds.
- The migration map resolves every legacy identifier to a current path.
- Follow-up review once the open-PR backlog has merged: confirm no identifier
  collision has recurred.

## Follow-up work

- Reconcile the 13 open PRs carrying architecture artifacts (tracked in
  [#2232](https://github.com/exelearning/exelearning/issues/2232)).
- Apply the same model to the satellite repositories (`wp-exelearning`,
  `omeka-s-exelearning`, `moodle-mod_exelearning`), each under its own tracking
  issue.

## References

- Tracking issue: [#2232](https://github.com/exelearning/exelearning/issues/2232)
- Workflow this supersedes in practice: [#2148](https://github.com/exelearning/exelearning/issues/2148), [#2149](https://github.com/exelearning/exelearning/pull/2149)
- Change documents: [`doc/architecture/changes/2232-issue-based-architecture-identifiers/`](../changes/2232-issue-based-architecture-identifiers/proposal.md)
- Migration map: [`doc/architecture/migration-map.md`](../migration-map.md)
- Kubernetes KEP process — https://github.com/kubernetes/enhancements/blob/master/keps/README.md
- MADR — https://adr.github.io/madr/
- Rust RFCs — https://github.com/rust-lang/rfcs
- OpenSpec concepts — https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md
- GitHub Spec Kit — https://github.com/github/spec-kit/blob/main/spec-driven.md
- adr-tools — https://github.com/npryce/adr-tools
- git-adr — https://github.com/zircote/git-adr
