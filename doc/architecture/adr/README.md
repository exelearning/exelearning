# Architecture Decision Records

## Purpose

An **Architecture Decision Record (ADR)** captures a single durable architectural
decision together with the reasoning behind it: the context, the problem, the
options that were considered, the evidence that informed the choice, the decision
itself, and the consequences that follow.

ADRs exist so that eXeLearning contributors — human and AI — can answer *"why is
it built this way?"* years later, without archaeology through pull request
threads or chat logs. A decision that is only recorded inside a PR description is
easy to lose; an ADR is a first-class, long-lived document.

Guiding principles, borrowed from the traceability workflow used in
[`exelearning/mod_exelearning`](https://github.com/exelearning/mod_exelearning):

- **Evidence before preference.** Prefer a verifiable source over an assertion.
- **No technical claim without a source.** Cite a repository path + commit,
  official documentation, a benchmark, a reproducible experiment, an issue, a
  PR, an SDD, or a previous ADR.
- **Separate facts, interpretation and decision.** Say what is observed, what it
  means, and what was decided — in that order.
- **Stable, monotonic IDs.** IDs are never reused.
- **Append-only.** Accepted decisions are not rewritten; they are superseded.

## ADRs vs SDDs

ADRs and [Software Design Documents (SDDs)](../sdd/README.md) are complementary,
not competing.

| Artifact | Answers | Lifetime |
|----------|---------|----------|
| **SDD** | *What* will be built and *how* a significant change will be implemented | May become historical once implemented |
| **ADR** | *Which* durable decision was made and *why* | Long-lived, append-only |
| **PR** | The concrete code/doc changes under review | Historical review record |
| **Issue** | The problem, proposal or discussion being coordinated | Historical coordination record |

A large change usually starts with an SDD that describes the design and the
implementation plan. Inside that SDD, the decisions that will outlive the change
itself — a storage model, a file-format guarantee, a security boundary — should
be extracted into ADRs or linked to existing ones. The SDD records the design;
the ADR records the decision and its rationale. Do **not** copy the whole SDD
into an ADR.

## ADRs vs OpenSpec / spec-driven workflows

Spec-driven development (SDD, in the "spec" sense) and tools such as
[OpenSpec](https://github.com/Fission-AI/OpenSpec) focus on aligning humans and
AI assistants on *what to build* **before** any code is written. OpenSpec, for
example, organizes each change as a proposal → review → implement → archive cycle
where a change folder carries its proposal, specs, design and tasks
(see the OpenSpec [concepts documentation](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md)).

That is the same problem our **SDD** documents address: intent and plan before
implementation. ADRs address a different, longer-lived problem: *why* a durable
architectural decision was made, and what was rejected.

The main eXeLearning repository does **not** depend on OpenSpec or any external
spec tool. OpenSpec is referenced here only as prior art for the spec-driven
half of the workflow. Adopting it (or GitHub's Spec Kit, or any other tool)
formally would itself be an architecture decision, and would require its own ADR
and reviewer approval.

## When an ADR is required

Create or update an ADR when a change **introduces or modifies a durable
architectural decision** — one that future contributors should not have to
re-litigate. In eXeLearning this includes decisions affecting:

- overall architecture (e.g. client-as-source-of-truth, browser-first export);
- storage model (IndexedDB, Cache API, server persistence, Yjs snapshots);
- file formats (ELP / ELPX / `content.xml`) and backward-compatibility guarantees;
- import/export behavior and the export pipeline;
- the real-time collaboration model (Yjs, WebSocket relay);
- security, sandboxing, or content-sanitization boundaries;
- accessibility strategy;
- public API contracts (REST API v1, embedding/`postMessage` bridge);
- AI-assisted generation workflows and policies.

If in doubt, prefer writing a short ADR over losing the reasoning.

## When an ADR is not required

Do **not** write an ADR for:

- bug fixes that restore intended behavior;
- routine refactors with no externally observable decision;
- dependency bumps, lint/format changes, copy edits;
- purely local implementation details with no cross-cutting impact.

If a change is significant enough to need a design but does not yet lock a
durable decision, start with an [SDD](../sdd/README.md) instead.

## Location and naming

- ADRs live in `doc/architecture/adr/`.
- Filenames follow: `ADR-NNNN-short-kebab-case-title.md` — for example
  `ADR-0001-store-assets-by-content-hash.md`.
- IDs are zero-padded, monotonic and never reused. The next ID is
  `max(existing) + 1`.
- [`ADR-0000-template.md`](ADR-0000-template.md) is the canonical template.
  Copy it to a new file and assign the next ID.
- [`records.md`](records.md) lists every ADR. For now the index is maintained by
  hand; generation tooling can be added later if the process grows.

## Status values

| Status | Meaning |
|--------|---------|
| `Proposed` | Under discussion; not yet agreed. |
| `Accepted` | Agreed and in force. |
| `Rejected` | Considered and declined. Kept for the record. |
| `Superseded` | Replaced by a later ADR (see `superseded_by`). |

A decision that is still being debated stays `Proposed`. It becomes `Accepted`
only after reviewer approval.

## Evidence and traceability

Every technical claim in an ADR should cite a verifiable source. Acceptable
evidence includes:

- a repository path plus commit (e.g. `src/shared/export/BaseExporter.ts` @ `abc1234`);
- official documentation or a specification;
- a benchmark or a reproducible experiment;
- a linked issue, PR, SDD, or prior ADR.

Keep the evidence **inside** the ADR for now. The main repository intentionally
does not (yet) maintain a separate `sources/`, `experiments/`, or `schemas/`
tree; introducing one would be a process change for reviewers to approve.

## AI-assisted ADRs

If an AI tool helped draft or research an ADR, disclose it in the frontmatter:

```yaml
ai_assistance:
  tool: "Claude Code"        # tool / interface used
  model: "claude-opus-4-8"   # model, when relevant
```

If no AI tool was involved, set both fields to `none`. Disclosure is about
traceability, not judgement: it records how the document was produced so the
evidence can be weighed accordingly.

## Superseding an ADR

Accepted ADRs are **append-only**. Do not rewrite them except to fix typos or
broken links.

To change an accepted decision:

1. Create a new ADR with the next ID.
2. Set `supersedes: [ADR-XXXX]` in the new ADR's frontmatter.
3. Set `status: Superseded` and `superseded_by: [ADR-YYYY]` in the old ADR.
4. Update [`records.md`](records.md).

This keeps the decision history intact and readable in order.

## Referencing ADRs

Refer to ADRs by their ID so links stay stable:

- **From code / comments:** `// See ADR-0007 for why assets are addressed by hash.`
- **From docs:** `[ADR-0007](adr/ADR-0007-....md)` (adjust the relative path).
- **From an SDD:** list the ADR in the SDD's *ADRs required or referenced* table.
- **From a PR or issue:** mention `ADR-0007` in the description and link the file.

## Workflow

1. Identify a durable decision (see *When an ADR is required*).
2. Copy [`ADR-0000-template.md`](ADR-0000-template.md) to
   `ADR-NNNN-short-title.md` with the next ID.
3. Fill in context, problem, options, evidence, decision and consequences.
   Start at `status: Proposed`.
4. Add the ADR to [`records.md`](records.md).
5. Open (or reference) a PR. Reviewers discuss and, if agreed, the status moves
   to `Accepted`.
6. If a later change reverses the decision, supersede it — never edit the
   accepted record.

## Review checklist

- [ ] The ADR has a unique, monotonic ID and a kebab-case title.
- [ ] Context, problem, options, decision and consequences are all present.
- [ ] Every technical claim cites a verifiable source.
- [ ] Positive, negative and neutral consequences are stated honestly.
- [ ] `status` reflects reality (`Proposed` while under discussion).
- [ ] `ai_assistance` is filled in (values or `none`).
- [ ] Superseding ADRs set `supersedes` / the old ADR sets `superseded_by`.
- [ ] [`records.md`](records.md) is updated.
