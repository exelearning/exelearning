---
tracking_issue: 2232
title: "Issue-based architecture identifiers — design"
date: 2026-08-05
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# Issue-based architecture identifiers — design

Technical design of the validation and index-generation tool, and of the
repository layout it enforces. The normative rules it implements are in
[`spec.md`](spec.md).

## Repository layout

```text
doc/architecture/
├── migration-map.md                     retired identifier → current path
├── adr/
│   ├── README.md                        ADR policy
│   ├── template.md                      ADR template
│   └── ADR-<number>-<NN>-<slug>.md      the records
└── changes/
    ├── README.md                        change-document policy
    ├── template.md                      change template (all five documents)
    └── <number>-<slug>/
        ├── proposal.md
        ├── spec.md
        ├── design.md
        ├── research.md
        └── tasks.md
```

`doc/architecture/sdd/` is removed; its policy, template and index moved to
`changes/`.

## Tool

`scripts/architecture-records.mts`, run by Bun. This matches the existing
repository tooling convention — `scripts/` already holds `check-coverage.ts`,
`build-static-bundle.ts` and friends, each a Bun-executed TypeScript file with a
colocated `*.spec.ts`.

```bash
bun run scripts/architecture-records.mts list    # print the index to stdout
bun run scripts/architecture-records.mts check   # validate; non-zero on failure
```

Wrapped by `make architecture-records` and `make architecture-check`.

### Why the index is not a file

An index derived entirely from frontmatter has no business being committed. A
generated file in version control conflicts on **every** concurrent branch — the
same class of problem this change exists to remove — and CI would then be
enforcing that contributors keep re-generating an artifact nobody edits by hand.

These records are also contributor-facing rather than published documentation, so
`doc/architecture/adr/` and `doc/architecture/changes/` are excluded from the
MkDocs site via `exclude_docs`. That removes the one reason to keep a rendered
index around. Contributors read the directory on GitHub, or run
`make architecture-records`.

### Why no YAML dependency

The repository has no YAML parser in its dependency tree, and adding one for a
documentation linter is not warranted. The tool ships `parseFrontmatter`, which
handles exactly the subset the schema uses:

- `key: scalar`
- `key: [a, b, c]` — inline list
- `key:` followed by `  - item` lines — block list
- one level of nesting (`related:` → `prs`/`changes`/`adrs`;
  `ai_assistance:` → `tool`/`model`)

Anything outside that subset is not valid architecture frontmatter. The parser is
exported and unit-tested directly.

### Pipeline

```text
discoverAdrs(root)      → Adr[]      + structural errors (filename grammar, missing frontmatter)
discoverChanges(root)   → Change[]   + structural errors (directory grammar, no documents)
validate(adrs, changes) → Diagnostic[]  (fields, ids, duplicates, statuses, dates, cross-refs, supersession)
findLegacyReferences()  → Diagnostic[]  (retired identifiers across `git ls-files`)
renderAdrIndex/renderChangeIndex → deterministic Markdown
```

`list` refuses to print when structural problems exist — an index built from a
half-parsed corpus is worse than no index. `check` reports every diagnostic and
exits non-zero.

### Identifier grammars

```ts
ADR_FILENAME_RE = /^ADR-([1-9][0-9]*)-([0-9]{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
CHANGE_DIR_RE   = /^([1-9][0-9]*)-([a-z0-9]+(?:-[a-z0-9]+)*)$/
LEGACY_ID_RE    = /\b(?:ADR|SDD)-[0-9]{4}(?!-[0-9]{2})\b/
```

Two subtleties that cost a debugging cycle each, recorded so they are not
reintroduced:

1. **The new grammar must be tested before the legacy pattern.**
   `ADR-1858-01-…` also begins with four digits, so a legacy-first check rejects
   every valid new record.
2. **`LEGACY_ID_RE` needs the negative lookahead.** Without `(?!-[0-9]{2})`,
   `ADR-1858-01` matches its own `ADR-1858` prefix and every migrated record is
   flagged as referencing a retired identifier.

### Retired-identifier scan

Runs over `git ls-files`, so it respects `.gitignore` and never walks
`node_modules`. Files containing a NUL byte are skipped as binary. Two exemptions:

- `LEGACY_REFERENCE_ALLOWLIST` — the migration map, the policy ADR, and this
  change's own directory. Documenting a migration requires naming what was
  migrated.
- **Self-reference.** A document whose frontmatter declares `legacy_id: SDD-0009`
  may mention `SDD-0009` in its own provenance note. This is derived from the
  document, not hard-coded.

### Determinism

ADRs sort by `(tracking number, local sequence)`; changes sort by
`(tracking number, slug)`. Both are total orders over valid records, so the
listing is reproducible.

## Integration

| Surface | Change |
|---|---|
| `Makefile` | `architecture-records` (print) and `architecture-check` (validate); `architecture-check` added to `lint` |
| `.github/workflows/ci.yml` | runs `make architecture-check` |
| `mkdocs.yml` | architecture records excluded from the site via `exclude_docs`; nav keeps only the Overview |
| `AGENTS.md` §7.11 | rewritten: issue-based identifiers, no `max(existing) + 1` |
| `doc/development/contributing.md` | rewritten to match |
| `doc/architecture.md` | section rewritten to match |

## Testing

`scripts/architecture-records.spec.ts`, run by `bun test`, covers the parser, the
grammars, each validation rule, the legacy scan and listing determinism, using
in-memory fixtures written to a temporary directory. The tool is pure with respect
to its `root` argument, so no fixture touches the real `doc/` tree.

## What this design does not do

- It does not verify that a tracking issue **exists** on GitHub, or that it is the
  *right* issue. That needs a network call and an API token; a typo'd but
  well-formed issue number passes. Filing under the wrong issue is a review
  concern, not a lint concern.
- It does not rename anything automatically. Migration renames are deliberate,
  reviewed `git mv` operations.
- It does not validate Markdown link targets in general; `mkdocs build --strict`
  already covers that.
