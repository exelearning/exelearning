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
  PR, a change document, or a previous ADR.
- **Separate facts, interpretation and decision.** Say what is observed, what it
  means, and what was decided — in that order.
- **Stable IDs.** An identifier is never reused and never changes once published.
- **Append-only.** Accepted decisions are not rewritten; they are superseded.

## ADRs vs change documents

ADRs and [change documents](../changes/README.md) are complementary, not
competing.

| Artifact | Answers | Lifetime |
|----------|---------|----------|
| **Change document** | *What* will be built and *how* a significant change will be implemented | May become historical once implemented |
| **ADR** | *Which* durable decision was made and *why* | Long-lived, append-only |
| **PR** | The concrete code/doc changes under review | Historical review record |
| **Issue** | The problem being coordinated, and the change's identity | Historical coordination record |

A large change usually starts with a proposal and a design in its
[change directory](../changes/README.md). Inside that design, the decisions that
will outlive the change itself — a storage model, a file-format guarantee, a
security boundary — should be extracted into ADRs or linked to existing ones. The
design records *how*; the ADR records *what was decided and why*. Do **not** copy
a whole design document into an ADR.

## Identification

ADRs are identified by their **GitHub tracking number**, not by a global counter.
The rationale, the rejected alternatives and the evidence are recorded in
[ADR-2232-01](ADR-2232-01-use-tracking-issue-based-architecture-identifiers.md).

The tracking number is the change's **issue** when it has one, and its **pull
request** when it does not. GitHub draws issue and pull-request numbers from a
single repository-wide sequence, so the two can never collide — in GitHub's data
model a pull request *is* an issue, which is why `/issues/<n>` resolves to a pull
request. Prefer the issue when one exists, because it predates implementation and
survives a change delivered by several pull requests, but **never open an issue
just to obtain an identifier**.

### Filename

```text
ADR-<tracking-number>-<local-sequence>-<decision-slug>.md
```

For example, issue [#1858](https://github.com/exelearning/exelearning/issues/1858)
produced four decisions:

```text
ADR-1858-01-restore-file-attachment-as-json-idevice.md
ADR-1858-02-use-asset-uri-references.md
ADR-1858-03-remap-legacy-file-attachments.md
ADR-1858-04-fail-safe-accessible-attachment-rendering.md
```

### Rules

- **A GitHub tracking number is required** before an ADR is finalized: the
  change's issue if it has one, otherwise its pull request. Do not open an issue
  solely to get a number.
- `<tracking-number>` has no leading zeros.
- `<local-sequence>` is two digits, scoped **only** to that tracking number,
  starting at `01`. It is present even when a change has a single ADR, so that
  adding a second one later never renames the first.
- A local sequence is never reused within the same tracking number, even if a
  record is rejected or removed.
- `<decision-slug>` is lowercase kebab-case and names the **decision**, not the
  topic. `use-asset-uri-references` is a decision; `file-attachment` is a topic.
- The frontmatter `id` must equal `ADR-<tracking-number>-<local-sequence>`, and
  `tracking_issue` must equal the tracking number. CI enforces both. The field
  keeps the name `tracking_issue` because GitHub models a pull request as an
  issue; it holds whichever number identifies the change.
- The document H1 must be `# <id>: <title>`.
- There is **no global counter** and no next-free-number to compute. Two branches
  can only collide if they share a tracking number.
- If a change starts as a pull request and later gets an issue, **keep the
  original identifier**. Identifiers are stable once published; record the issue
  in the change document instead.

### Where things live

- ADRs live in `doc/architecture/adr/`.
- [`template.md`](template.md) is the canonical template.
- There is **no committed index**. Run `make architecture-records` to print one,
  derived from frontmatter. A generated file in git conflicts on every concurrent
  branch, and this index is contributor-facing — it is not published docs.
- [`../migration-map.md`](../migration-map.md) maps every retired identifier to
  its current path.

## Status values

| Status | Meaning |
|--------|---------|
| `Proposed` | Under discussion; not yet agreed. |
| `Accepted` | Agreed and in force. |
| `Rejected` | Considered and declined. Kept for the record. |
| `Superseded` | Replaced by a later ADR (see `superseded_by`). |

A decision that is still being debated stays `Proposed`. It becomes `Accepted`
only after reviewer approval.

Status lives in the frontmatter **only**. Do not add a `## Status` section that
repeats it — one canonical source per mutable field.

## Canonical metadata

| Field | Required | Canonical source for |
|---|---|---|
| `id` | yes | the record's identity (must match the filename) |
| `title` | yes | the record's title (mirrored by the H1) |
| `status` | yes | lifecycle state |
| `date` | yes | creation date, `YYYY-MM-DD` |
| `tracking_issue` | yes | the GitHub number that owns this decision — issue, or PR when there is no issue |
| `legacy_id` | migrated records only | the retired identifier |
| `deciders` | yes | who decided |
| `reviewers` | no | who reviewed |
| `related.prs` | no | implementation / review traceability |
| `related.changes` | no | change directories this decision belongs to |
| `related.adrs` | no | sibling decisions |
| `supersedes` / `superseded_by` | no | decision history |
| `ai_assistance.tool` / `.model` | yes | provenance (`none` if unused) |

`related.prs` is **traceability metadata**: it lists every PR that implements or
reviews the decision, and it is not what identifies the record. When a change has
no issue, its PR number *is* the tracking number — but that is the single number
in `tracking_issue`, chosen once and then stable, not the growing list in
`related.prs`.

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

Do not create an ADR per section of a design document, and do not create empty
ADRs to fill a gap in the sequence — the sequence is expected to have gaps.

If a change is significant enough to need a design but does not yet lock a
durable decision, start with a [change document](../changes/README.md) instead.

## Evidence and traceability

Every technical claim in an ADR should cite a verifiable source. Acceptable
evidence includes:

- a repository path plus commit (e.g. `src/shared/export/BaseExporter.ts` @ `abc1234`);
- official documentation or a specification;
- a benchmark or a reproducible experiment;
- a linked issue, PR, change document, or prior ADR.

Keep the evidence **inside** the ADR. The main repository intentionally does not
maintain a separate `sources/`, `experiments/`, or `schemas/` tree; introducing
one would be a process change for reviewers to approve.

## AI-assisted ADRs

If an AI tool helped draft or research an ADR, disclose it in the frontmatter:

```yaml
ai_assistance:
  tool: "Claude Code"        # tool / interface used
  model: "claude-opus-5"     # model, when relevant
```

If no AI tool was involved, set both fields to `none`. Disclosure is about
traceability, not judgement: it records how the document was produced so the
evidence can be weighed accordingly.

## Superseding an ADR

Accepted ADRs are **append-only**. Do not rewrite them except to fix typos or
broken links.

To change an accepted decision:

1. Create a new ADR under the tracking issue that motivates the change.
2. Set `supersedes: [ADR-<old-id>]` in the new ADR's frontmatter.
3. Set `status: Superseded` and `superseded_by: [ADR-<new-id>]` in the old ADR.
4. Run `make architecture-check` to validate the relationship.

CI rejects a one-sided relationship: both directions must be present, and a
superseded ADR must carry `status: Superseded`.

## Referencing ADRs

Refer to ADRs by their ID so links stay stable:

- **From code / comments:** `// See ADR-1858-02 for why attachments use asset:// references.`
- **From docs:** `[ADR-1858-02](adr/ADR-1858-02-use-asset-uri-references.md)` (adjust the relative path).
- **From a change document:** list the ADR in `related_adrs` and in the *ADRs
  required or referenced* table.
- **From a PR or issue:** mention `ADR-1858-02` and link the file.

Retired identifiers — the old four-digit `ADR-NNNN` / `SDD-NNNN` form — must not
appear in new content. CI fails on them; use
[`../migration-map.md`](../migration-map.md) to find the current identifier.

## Workflow

1. Identify the change's **GitHub tracking number** — its issue if it has one,
   otherwise its pull request. Do not open an issue just to get a number.
2. Identify the durable decision (see *When an ADR is required*).
3. Copy [`template.md`](template.md) to
   `ADR-<number>-<NN>-<decision-slug>.md`, where `<NN>` is the next free local
   sequence **for that tracking number only** (`01` if it is the first).
4. Fill in context, problem, options, evidence, decision and consequences.
   Start at `status: Proposed`.
5. Run `make architecture-check` to validate. `make architecture-records` prints
   the current index if you want to read it.
6. Open (or reference) a PR. Reviewers discuss and, if agreed, the status moves
   to `Accepted`.
7. If a later change reverses the decision, supersede it — never edit the
   accepted record.

## Review checklist

- [ ] The change has a tracking number (issue, or PR when there is no issue),
      and the filename uses it.
- [ ] The local sequence is the next free one **for that number**, starting at `01`.
- [ ] The slug names the decision, not the topic.
- [ ] Frontmatter `id` matches the filename; `tracking_issue` matches the number.
- [ ] The H1 is `# <id>: <title>`.
- [ ] Context, problem, options, decision and consequences are all present.
- [ ] Every technical claim cites a verifiable source.
- [ ] Positive, negative and neutral consequences are stated honestly.
- [ ] `status` reflects reality (`Proposed` while under discussion), and appears
      only in the frontmatter.
- [ ] `ai_assistance` is filled in (values or `none`).
- [ ] Superseding ADRs set `supersedes` / the old ADR sets `superseded_by` and
      `status: Superseded`.
- [ ] `make architecture-check` passes.
