# Software Design Documents

## Purpose

A **Software Design Document (SDD)** describes *what* a significant change will
build and *how* it will be implemented. It is the design gate for large work:
the place to agree on goals, non-goals, user experience, technical design, data
model, migration, security, accessibility, testing and rollout **before**
implementation starts.

An SDD makes a big change reviewable as a whole, instead of arriving as a large
pull request that reviewers must reverse-engineer. The Software Design Document
introduced by PR
[`#2147`](https://github.com/exelearning/exelearning/pull/2147) — the
interactive-video iDevice refactor — is an example of this kind of
design-gated proposal document.

## SDDs vs ADRs

| Artifact | Answers | Lifetime |
|----------|---------|----------|
| **SDD** | *What* will be built and *how* it will be implemented | May become historical once implemented |
| **ADR** | *Which* durable decision was made and *why* | Long-lived, append-only |

An SDD is a **design**; an [ADR](../adr/README.md) is a **decision**. A single
SDD often contains several durable decisions (a storage choice, a compatibility
guarantee, a security boundary). Those belong in ADRs so they outlive the
feature work — the SDD then links to them instead of burying them in prose.

> Every significant proposal may start with an SDD. Every durable architectural
> decision inside that SDD should either link to an existing ADR or propose a new
> ADR.

## SDDs vs OpenSpec / spec-driven workflows

"Spec-driven development" and tools such as
[OpenSpec](https://github.com/Fission-AI/OpenSpec) exist to align humans and AI
assistants on *what to build* before code is written — the same goal as an SDD.
OpenSpec organizes each change as a proposal → review → implement → archive cycle
with its own proposal, specs, design and tasks
(see the OpenSpec [concepts documentation](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md)).

Our SDD is a lightweight, English, Markdown-first version of that idea that lives
directly in `doc/` and needs no extra tooling. The main eXeLearning repository
does **not** adopt OpenSpec or any external spec tool as a dependency. It is
mentioned here as prior art; formally adopting such a tool would be its own
architecture decision (and its own ADR).

## When an SDD is required

Write an SDD for work that needs a design gate before implementation:

- significant new features;
- major refactors or rewrites of a subsystem;
- cross-cutting changes (export pipeline, collaboration, storage, embedding);
- proposals with multiple implementation phases;
- changes that touch several of: architecture, storage, file formats,
  import/export, security, accessibility, or public APIs.

## When an SDD is not required

Skip the SDD for:

- bug fixes and small enhancements;
- localized changes with an obvious implementation;
- work already fully covered by an existing, current SDD.

A durable decision that needs no full design can go straight to an
[ADR](../adr/README.md).

## Location and naming

- SDDs live in `doc/architecture/sdd/`.
- Filenames follow: `SDD-NNNN-short-kebab-case-title.md` — for example
  `SDD-0001-interactive-video-refactor.md`.
- IDs are zero-padded, monotonic and never reused. The next ID is
  `max(existing) + 1`.
- [`SDD-0000-template.md`](SDD-0000-template.md) is the canonical template.
- [`records.md`](records.md) lists every SDD. The index is maintained by hand for
  now; generation tooling can be added later if the process grows.

## Status values

| Status | Meaning |
|--------|---------|
| `Draft` | Being written; not yet ready for review. |
| `In Review` | Under review; open for feedback. |
| `Accepted` | Design agreed; implementation may start. |
| `Implemented` | The design has shipped. Kept as a historical record. |
| `Superseded` | Replaced by a newer SDD (see `superseded_by`). |
| `Abandoned` | Dropped before implementation. Kept for the record. |

An SDD can be edited freely while it is `Draft` or `In Review`. Once
`Implemented`, avoid rewriting it except for typo/link fixes. If the design
changes substantially, create a new SDD or mark the previous one `Superseded`.

## Evidence and traceability

As with ADRs, technical claims should cite a verifiable source: a repository path
plus commit, official documentation, a benchmark, a reproducible experiment, or a
linked issue, PR or ADR. Keep the evidence inside the SDD for now; the main
repository does not maintain a separate `sources/` or `experiments/` tree.

## AI-assisted SDDs

If an AI tool helped draft or research an SDD, disclose it in the frontmatter:

```yaml
ai_assistance:
  tool: "Claude Code"        # tool / interface used
  model: "claude-opus-4-8"   # model, when relevant
```

If no AI tool was involved, set both fields to `none`.

## Linking SDDs and ADRs

Every SDD template includes an **ADRs required or referenced** table. Use it to:

- link durable decisions to existing ADRs; or
- flag decisions that still need an ADR (`ADR needed`).

Do not duplicate a full SDD inside an ADR. The ADR records the decision and its
rationale; the SDD records the implementation design. An ADR may, in turn,
reference one or more SDDs.

## Superseding or abandoning an SDD

- **Substantial design change:** create a new SDD (or set the old one to
  `Superseded` with `superseded_by`).
- **Design dropped before implementation:** set `status: Abandoned` and note why.
- **Shipped:** set `status: Implemented`. Keep it as a historical design record;
  do not delete it.

## Referencing SDDs

Refer to SDDs by their ID so links stay stable:

- **From a PR or issue:** mention `SDD-0001` and link the file.
- **From an ADR:** list the SDD under `related.sdds` and in the References.
- **From docs / code:** `[SDD-0001](sdd/SDD-0001-....md)` (adjust the relative path).

## Workflow

1. Copy [`SDD-0000-template.md`](SDD-0000-template.md) to
   `SDD-NNNN-short-title.md` with the next ID. Start at `status: Draft`.
2. Fill in the design: problem, goals, non-goals, technical design, migration,
   security, accessibility, testing, rollout, risks and acceptance criteria.
3. List durable decisions in the *ADRs required or referenced* table; create or
   link ADRs for them.
4. Add the SDD to [`records.md`](records.md) and open (or reference) a PR. Move to
   `In Review`.
5. On approval, set `Accepted` and implement. When it ships, set `Implemented`.

## Review checklist

- [ ] The SDD has a unique, monotonic ID and a kebab-case title.
- [ ] Goals and non-goals are explicit.
- [ ] Migration/compatibility, security, accessibility and testing are addressed.
- [ ] Durable decisions are captured in the *ADRs required or referenced* table.
- [ ] Every technical claim cites a verifiable source.
- [ ] `status` reflects reality (`Draft`/`In Review` while under discussion).
- [ ] `ai_assistance` is filled in (values or `none`).
- [ ] [`records.md`](records.md) is updated.
