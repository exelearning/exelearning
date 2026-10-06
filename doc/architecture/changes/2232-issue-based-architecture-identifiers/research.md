---
tracking_issue: 2232
title: "Issue-based architecture identifiers — research"
date: 2026-08-05
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# Issue-based architecture identifiers — research

Evidence gathered before choosing the identification model. Repository
measurements were taken on `main` at `fb9705f9c` and against the open pull
requests as of 2026-08-05.

## 1. Repository measurements

### 1.1 Identifier collisions across branches

Method: collect every `ADR-NNNN` / `SDD-NNNN` filename on `main` and in the file
list of each open PR, then count distinct claimants per identifier.

Result: **67 artifact claims across 14 branches; 16 identifiers claimed more than
once.**

| ID | Claims | Claimants |
|---|---|---|
| ADR-0001 | 6 | `main`, #2209, #2199, #2164, #2157, #2147 |
| ADR-0002 | 2 | #2199, #2147 |
| ADR-0003 | 2 | #2199, #2147 |
| ADR-0004 | 2 | #2199, #2147 |
| ADR-0006 | 2 | #2199, #2147 |
| ADR-0016 | 2 | #2199, #1497 |
| ADR-0017 | 2 | #2199, #1425 |
| ADR-0018 | 2 | #2199, #1425 |
| ADR-0019 | 2 | #2199, #1425 |
| ADR-0020 | 2 | #2199, #2007 |
| ADR-0021 | 2 | #2199, #2007 |
| ADR-0022 | 2 | #2199, #2007 |
| ADR-0023 | 2 | #2199, #2007 |
| ADR-0024 | 2 | #2199, #2007 |
| ADR-0043 | 2 | #2209, #1868 |
| SDD-0001 | 2 | #2157, #2147 |

The collision is invisible to Git: two branches adding
`ADR-0001-scorm12-runtime-rewrite.md` and
`ADR-0001-three-d-viewer-interaction-layer.md` merge without conflict, leaving two
records sharing one identifier.

### 1.2 Ordering

`main` before migration:

| File | id | date |
|---|---|---|
| `ADR-0035-…` | ADR-0035 | 2026-07-09 |
| `ADR-0042-…` | ADR-0042 | 2026-07-16 |
| `ADR-0001-…` | ADR-0001 | 2026-07-21 |

The lowest number was the newest record.

### 1.3 Index drift

`doc/architecture/adr/records.md` listed 2 of the 6 ADRs present on `main`.
`doc/architecture/sdd/records.md` listed 0 of the 1 SDD present and stated "No
draft SDDs yet".

### 1.4 Metadata drift

`ADR-0042` used `issues: ["#2184"]`; all five other records used `issues: [1858]`
or `issues: [2193]` — bare integers. Nothing validated the shape.

## 2. External prior art

### 2.1 Kubernetes Enhancement Proposals — the direct precedent

> "KEPs are now prefixed with their associated tracking issue number. This gives
> both the KEP a unique identifier and provides an easy breadcrumb for people to
> find the issue where the current state of the KEP is being updated."

— [kubernetes/enhancements, `keps/README.md`](https://github.com/kubernetes/enhancements/blob/master/keps/README.md)

Directory listing of `keps/sig-architecture/` confirms the convention in practice:
`1143-node-role-labels`, `1194-prod-readiness`, `2527-clarify-status-observations-vs-rbac`,
`3136-beta-apis-off-by-default`, `4330-compatibility-versions`. The same directory
still holds one legacy date-named file, `20190731-production-readiness-review-process.md`,
showing the convention they moved away from.

KEP metadata lives in a `kep.yaml` with `title`, `status`, `authors`,
`owning-sig`, `reviewers`, `approvers`, `creation-date`, `last-updated`,
`replaces` and `superseded-by` — closely matching the frontmatter we already use.

### 2.2 MADR

Default naming is `NNNN-title-with-dashes.md`, where "NNNN is a consecutive number
and we assume that there won't be more than 9,999 ADRs in one repository". MADR
explicitly permits other directory patterns and notes that with subdirectories
"numbers of ADRs are no longer unique throughout the repository, but locally within
a category only" — [adr.github.io/madr](https://adr.github.io/madr/).

Relevance: locally scoped ADR numbers are within the MADR tradition. Scoping by
tracking issue rather than by category is a variation on a sanctioned pattern, not
a departure from it.

### 2.3 Rust RFCs

The number is the pull request number. Authors copy `0000-template.md` to
`text/0000-my-feature.md`, open the PR, then "use the issue number of the PR to
rename the file: update your `0000-` prefix to that number"
([rust-lang/rfcs](https://github.com/rust-lang/rfcs)).

Relevance: proves GitHub-allocated numbers work at scale, and is the strongest
alternative. Rejected because it binds a durable decision's identity to a review
artifact and cannot express a change delivered by several PRs.

### 2.4 OpenSpec

Each change is a self-contained folder:

```text
openspec/changes/add-dark-mode/
├── proposal.md
├── design.md
├── tasks.md
├── .openspec.yaml
└── specs/
    └── ui/
        └── spec.md
```

Change names are kebab-case, validated against
`^[a-z0-9]+(?:-[a-z0-9]+)*$` with a 200-character limit
([concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md),
[`src/core/id.ts`](https://github.com/Fission-AI/OpenSpec/blob/main/src/core/id.ts)).
Stated benefits: "everything together, parallel work, clean history, and
review-friendly".

Relevance: directly informs the `changes/<issue>-<slug>/` layout and the
proposal / design / tasks split. OpenSpec is **not** adopted as a dependency.

### 2.5 GitHub Spec Kit

Per-feature directories such as `specs/003-chat-system/` containing `spec.md`,
`plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` and
`tasks.md` ([spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md)).

Relevance: corroborates the per-change directory model, and supplies `research.md`
and `tasks.md` as recognised artifact names.

### 2.6 adr-tools

Ships `adr generate toc` alongside `adr new`, `adr list` and `adr link`; the
source tree contains `_adr_generate_toc` and `adr-generate`
([npryce/adr-tools](https://github.com/npryce/adr-tools)).

Relevance: index generation is a solved, tooled concern. A hand-maintained index
is a choice, and ours demonstrably failed.

### 2.7 git-adr

Stores ADRs in Git notes — "no files, no merge conflicts, linked to commits"
([zircote/git-adr](https://github.com/zircote/git-adr)).

Relevance: the only option that eliminates file conflicts outright. Rejected
because records would disappear from PR diffs, from MkDocs, and from ordinary
repository browsing.

### 2.8 Issue and pull-request numbers share one sequence

GitHub allocates issue and pull-request numbers from a single per-repository
sequence, and models a pull request as a kind of issue — `/issues/<n>` resolves to
a pull request. This change is its own evidence: the tracking issue was allocated
#2232 and the pull request that implements it was allocated #2233, consecutively.

Consequence: a pull-request number is exactly as collision-free as an issue number,
so a change with no issue can safely use its PR number as the namespace instead of
having an issue opened for it.

## 3. Conclusion

The Kubernetes precedent matches our problem exactly — many parallel proposals,
each needing an identifier before implementation, several documents per change —
and has been in production use at far greater scale than this repository. Combining
it with OpenSpec's per-change directory layout and adr-tools' generated index
addresses all three measured problems (contention, ordering, rot) without adopting
an external tool as a dependency.
