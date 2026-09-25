# Architecture records

Paths and commands below are relative to the repository root.


Significant technical work is documented before or alongside the code. Full policy: [ADR guide](../../doc/architecture/adr/README.md), [change guide](../../doc/architecture/changes/README.md).

**Identifiers are based on the GitHub tracking number — there is NO global counter.** Never compute `max(existing) + 1`; that rule is retired (see [ADR-2232-01](../../doc/architecture/adr/ADR-2232-01-use-tracking-issue-based-architecture-identifiers.md)). The tracking number is the change's **issue** if it has one, otherwise its **pull request** — GitHub draws both from one repository-wide sequence, so they never collide. **Never open an issue just to obtain an identifier.**

- **ADR filename**: `ADR-<number>-<NN>-<decision-slug>.md`, e.g. `ADR-1858-02-use-asset-uri-references.md`. `<NN>` is a two-digit sequence scoped **only to that tracking number**, starting at `01`; it is present even for a single ADR. The slug names the decision, not the topic. Frontmatter `id` and `tracking_issue` must match the filename (`tracking_issue` keeps its name because GitHub models a PR as an issue).
- **Change documents**: one directory per change, `doc/architecture/changes/<number>-<change-slug>/`, holding any of `proposal.md`, `spec.md`, `design.md`, `research.md`, `tasks.md`. **Create only the files with real content** — no empty placeholders — and don't duplicate content across them.
- **Create or update an ADR** when a change introduces or modifies a **durable architecture decision**: architecture, storage model, file formats (ELP/ELPX), import/export behavior, the collaboration model, security/sandboxing, accessibility strategy, public APIs (REST v1, embedding bridge), or AI-generation workflows. Don't create one ADR per section of a design, and don't create empty ADRs to fill sequence gaps — gaps are expected.
- **Create a change directory** for significant features, major refactors, design gates, cross-cutting changes, or proposals with multiple implementation phases. **Durable decisions inside a design must link to an ADR** (existing or newly proposed) — don't bury the decision.
- Templates: `doc/architecture/adr/template.md`, `doc/architecture/changes/template.md`.
- **There is no committed index.** `make architecture-records` prints one on demand; `make architecture-check` validates identifiers and metadata and runs in CI. Never create a `records.md` — a generated file in git conflicts on every concurrent branch, and these records are contributor-facing, so they are excluded from the published docs site.
- **Do not rewrite accepted ADRs** — supersede them with a new ADR (`supersedes` / `superseded_by`, and set the old one to `status: Superseded`). **Do not rewrite implemented designs** except for typo/link fixes.
- Status values: ADRs use `Proposed` / `Accepted` / `Rejected` / `Superseded`; change documents use `draft` / `in-review` / `accepted` / `implemented` / `superseded` / `abandoned`. Status lives in the frontmatter **only** — never add a `## Status` section.
- `implementation_prs` / `related.prs` are traceability lists, not the identifier. The identifier is the single stable number in `tracking_issue`.
- Retired `ADR-NNNN` / `SDD-NNNN` identifiers must not appear in new content; CI fails on them. See [`doc/architecture/migration-map.md`](../../doc/architecture/migration-map.md).
- Document AI assistance in the frontmatter (`ai_assistance.tool` / `ai_assistance.model`; `none` if not used).
- Mention any ADRs or change documents a PR creates or updates in the PR description.
